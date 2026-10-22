"""Heuristic column type and sensitivity detection for dataset columns.

Detection blends header-name hints with value-shape heuristics evaluated over a
capped sample of non-empty values. Every column is classified along two axes:

* ``type``        - what the data structurally looks like (NRIC, PHONE, ...).
* ``sensitivity`` - how it should be handled (PII, INDIRECT_PII, SENSITIVE, UNKNOWN).

Gated types (PASSPORT, DRIVING_LICENSE, AGE, TITLE, bare-valued PHONE) additionally
require a matching header hint on top of the value shape to avoid false
positives on generic codes. Values arrive as the normalized strings produced by
the service.
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Callable
from datetime import datetime

DetectedType = str
Sensitivity = str

NRIC_RE = re.compile(r"^[STFGM]\d{7}[A-Z]$")
CARD_RE = re.compile(r"^\d{13,19}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
URL_RE = re.compile(r"^(?:https?://|www\.)", re.IGNORECASE)
IPV4_RE = re.compile(r"^\d{1,3}(?:\.\d{1,3}){3}$")
IPV6_RE = re.compile(r"^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$")
PASSPORT_RE = re.compile(r"^[A-Z]\d{7}$")
DRIVING_LICENSE_RE = re.compile(r"^[A-Z]{1,2}\d{7,10}$")
_PHONE_SEPARATOR_RE = re.compile(r"[\s().+-]")
AGE_RE = re.compile(r"^(?:0|[1-9]\d{0,2})$")

# Unanchored variants for contact details embedded in free text.
_EMAIL_IN_TEXT_RE = re.compile(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}")
_PHONE_IN_TEXT_RE = re.compile(r"\+?\d[\d\s().-]{5,14}\d")

DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d-%m-%Y",
    "%m-%d-%Y",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d, %Y",
    "%B %d, %Y",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
)

_CURRENCY_CHARS = "$€£¥¤ "
_NUMERIC_WITH_DECIMAL = re.compile(r"^-?\d+(?:\.\d+)?$")
_NUMERIC_WITH_THOUSANDS = re.compile(r"^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$")


def _clean_candidate(value: str) -> str:
    candidate = value.strip().rstrip("%").replace(" ", "").strip()
    return candidate.lstrip(_CURRENCY_CHARS).rstrip(_CURRENCY_CHARS)


def parse_number(value: str) -> float | None:
    """Parse a numeric cell (plain, thousands-separated, %- or currency-wrapped)."""
    candidate = _clean_candidate(value)
    if _NUMERIC_WITH_DECIMAL.match(candidate) or _NUMERIC_WITH_THOUSANDS.match(
        candidate
    ):
        return float(candidate.replace(",", ""))
    return None


GENDER_VALUES = {
    "m",
    "f",
    "male",
    "female",
    "man",
    "woman",
    "boy",
    "girl",
    "others",
    "other",
    "nonbinary",
    "nonbinaryperson",
    "unknown",
    "na",
    "notapplicable",
    "prefernottosay",
}

# Age: header-gated, integer 0.._AGE_MAX. The allow-list catches concatenated
# header forms; ``_is_age_header`` additionally matches a standalone "age" token.
_AGE_MAX = 150
_AGE_HEADERS = frozenset(
    {
        "age",
        "ageyears",
        "yearsofage",
        "agegroup",
        "ageband",
        "agerange",
        "yearold",
        "yearsold",
    }
)

ADDRESS_RE = re.compile(
    r"\b(blk|block|street|st|road|rd|avenue|ave|lane|drive|crescent|close|walk|"
    r"place|terrace|floor|unit|boulevard|blvd|way|singapore|sector|district)\b|"
    r"#|(?<![\w-])\d{6}(?![\w-])",
    re.IGNORECASE,
)

# Specific types first. ``name`` is intentionally last since it is the broadest.
# ``DOB`` must precede ``DATE`` so birth-flavoured headers win over the general term.
HEADER_HINTS: tuple[tuple[tuple[str, ...], DetectedType], ...] = (
    (("nric", "fin", "identitycard", "nationalid", "icnumber"), "NRIC"),
    (("passport", "traveldocument"), "PASSPORT"),
    (
        (
            "cardnumber",
            "creditcard",
            "debitcard",
            "cardno",
            "cardnum",
            "ccnumber",
            "ccnum",
            "pan",
        ),
        "CARD",
    ),
    (
        (
            "drivinglicense",
            "drivinglicence",
            "licenseno",
            "licenceno",
            "license",
            "licence",
        ),
        "DRIVING_LICENSE",
    ),
    (
        ("phone", "mobile", "handphone", "telephone", "cellphone", "tel", "whatsapp", "contact"),
        "PHONE",
    ),
    (("email", "mail"), "EMAIL"),
    (("url", "website", "webpage", "web", "link", "domain"), "URL"),
    (("ipaddress", "ipaddr"), "IP_ADDRESS"),
    (("dob", "dateofbirth", "birthdate", "birthday"), "DOB"),
    (
        ("date", "timestamp", "created", "updated", "joined", "hire", "transact"),
        "DATE",
    ),
    (("gender", "sex"), "GENDER"),
    (
        (
            "address",
            "street",
            "postal",
            "postcode",
            "zip",
            "zipcode",
            "city",
            "town",
            "country",
            "addr",
            "residence",
        ),
        "ADDRESS",
    ),
    (("title", "designation", "rank", "role", "jobtitle", "jobrole"), "TITLE"),
    (("name", "fullname"), "NAME"),
)


# Headers that name an identifier rather than a measurement. A numeric column
# ending in one of these (Order, Bank Account, Serial Number) is a code, so the
# value shape must not turn it into a measured quantity.
_IDENTIFIER_HEADER_TOKENS = frozenset(
    {
        "id",
        "no",
        "num",
        "number",
        "code",
        "ref",
        "reference",
        "serial",
        "account",
        "order",
    }
)


def _header_tokens(header: str | None) -> list[str]:
    """Lowercase words in a header, splitting camelCase and punctuation."""
    if not header:
        return []
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", str(header))
    return [
        token for token in re.split(r"[^A-Za-z0-9]+", spaced.lower()) if token
    ]


def _header_candidates(header: str | None) -> set[str]:
    """Whole-word forms of a header: tokens, adjacent joins, and the full text.

    Matching candidates instead of substrings keeps short terms (``tin``,
    ``fin``) from firing on unrelated words such as ``Rating`` or ``Finance``.
    """
    tokens = _header_tokens(header)
    if not tokens:
        return set()
    candidates = set(tokens)
    candidates.add("".join(tokens))
    for size in (2, 3):
        for index in range(len(tokens) - size + 1):
            candidates.add("".join(tokens[index : index + size]))
    return candidates


def header_hint(header: str | None) -> DetectedType | None:
    if not header:
        return None
    if _is_age_header(header):
        return "AGE"
    candidates = _header_candidates(header)
    for keys, detected_type in HEADER_HINTS:
        if any(key in candidates for key in keys):
            return detected_type
    return None


def _is_nric(value: str) -> bool:
    return bool(NRIC_RE.match(value.upper().replace(" ", "")))


def _is_age_header(header: str | None) -> bool:
    candidates = _header_candidates(header)
    return bool(candidates & _AGE_HEADERS) or "age" in candidates


def _is_identifier_header(header: str | None) -> bool:
    """Whether the header names an identifier rather than a measurement."""
    tokens = _header_tokens(header)
    return bool(tokens) and tokens[-1] in _IDENTIFIER_HEADER_TOKENS


def _is_age(value: str) -> bool:
    candidate = value.strip()
    return bool(AGE_RE.match(candidate)) and int(candidate) <= _AGE_MAX


def _luhn(digits: str) -> bool:
    total = 0
    for index, char in enumerate(reversed(digits)):
        digit = ord(char) - 48
        if index % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0


def _is_card(value: str) -> bool:
    digits = re.sub(r"[\s-]", "", value)
    return bool(CARD_RE.match(digits)) and _luhn(digits)


def _is_phone(value: str, allow_bare: bool = False) -> bool:
    candidate = value.strip()
    if not candidate or re.search(r"[A-Za-z]", candidate):
        return False
    if not allow_bare and not _PHONE_SEPARATOR_RE.search(candidate):
        return False
    digits = re.sub(r"\D", "", candidate)
    return 7 <= len(digits) <= 15


def _is_email(value: str) -> bool:
    return bool(EMAIL_RE.match(value.strip()))


def _is_url(value: str) -> bool:
    candidate = value.strip()
    return bool(URL_RE.match(candidate)) and " " not in candidate


def _is_ip(value: str) -> bool:
    candidate = value.strip()
    if IPV4_RE.match(candidate):
        return all(0 <= int(octet) <= 255 for octet in candidate.split("."))
    return bool(IPV6_RE.match(candidate))


def _is_passport(value: str) -> bool:
    return bool(PASSPORT_RE.match(value.upper().replace(" ", "")))


def _is_driving_license(value: str) -> bool:
    return bool(DRIVING_LICENSE_RE.match(value.upper().replace(" ", "")))


def _is_date(value: str) -> bool:
    candidate = value.strip()
    for fmt in DATE_FORMATS:
        try:
            datetime.strptime(candidate, fmt)
        except ValueError:
            continue
        return True
    return False


def is_binnable(value: str) -> bool:
    """Whether a value can be binned into a range (numeric or date-shaped)."""
    return parse_number(value) is not None or _is_date(value)


def _is_numeric(value: str) -> bool:
    return parse_number(value) is not None


def is_free_text(value: str) -> bool:
    """Whether a value reads as prose rather than a label or a code."""
    candidate = value.strip()
    return (
        len(candidate) >= FREE_TEXT_MIN_LEN
        or len(candidate.split()) >= FREE_TEXT_MIN_WORDS
    )


def _is_gender(value: str) -> bool:
    return re.sub(r"[^a-z]", "", value.lower()) in GENDER_VALUES


def _is_address(value: str) -> bool:
    return bool(ADDRESS_RE.search(value))


_TITLE_TOKEN_RE = re.compile(
    r"^(?:[A-Za-z][A-Za-z.,&'/-]*|II|III|IV|V|VI|VII|VIII|IX|X)$"
)
_TITLE_MAX_LEN = 80
_TITLE_MAX_TOKENS = 6


def _is_title(value: str) -> bool:
    candidate = value.strip()
    if not candidate or len(candidate) > _TITLE_MAX_LEN:
        return False
    tokens = candidate.split()
    if not 1 <= len(tokens) <= _TITLE_MAX_TOKENS:
        return False
    return all(_TITLE_TOKEN_RE.match(token) for token in tokens)


def _is_name(value: str) -> bool:
    candidate = value.strip()
    if not candidate or len(candidate) > 60:
        return False
    if any(char.isdigit() for char in candidate):
        return False
    tokens = candidate.split()
    if not 1 <= len(tokens) <= 4:
        return False
    cleaned = [tok.replace("-", "").replace("'", "").replace(".", "") for tok in tokens]
    if not all(tok.isalpha() for tok in cleaned):
        return False
    capitalized = sum(1 for tok in tokens if tok[:1].isupper())
    return capitalized >= max(1, len(tokens) - 1)


# Order matters: more specific shapes run first so broad checks can't win.
# ``DOB``/``DATE`` precede ``PHONE`` because date-shaped values (1990-01-02)
# also look like dashed phone numbers. ``NUMERIC`` and ``TEXT`` sit after
# the identifier shapes (a bare phone number is also a number) and before
# ``ADDRESS`` (a six-digit number also looks like a postal code, and prose may
# mention streets). ``NAME`` stays last since it is the broadest, and is
# additionally gated on cardinality (below).
_VALUE_CHECKS: tuple[
    tuple[DetectedType, str], ...
] = (
    ("NRIC", "_is_nric"),
    ("CARD", "_is_card"),
    ("DOB", "_is_date"),
    ("DATE", "_is_date"),
    ("AGE", "_is_age"),
    ("PHONE", "_is_phone"),
    ("EMAIL", "_is_email"),
    ("URL", "_is_url"),
    ("IP_ADDRESS", "_is_ip"),
    ("GENDER", "_is_gender"),
    ("NUMERIC", "_is_numeric"),
    ("TEXT", "is_free_text"),
    ("ADDRESS", "_is_address"),
    ("PASSPORT", "_is_passport"),
    ("DRIVING_LICENSE", "_is_driving_license"),
    ("TITLE", "_is_title"),
    ("NAME", "_is_name"),
)

# Types whose value checkers are only meaningful with a matching header hint.
_HINT_GATED = {"PASSPORT", "DRIVING_LICENSE", "AGE", "TITLE"}

# Without a name-flavoured header, only treat a column as NAME once it has
# enough distinct values that it can't just be a low-cardinality category.
_NAME_MIN_UNIQUE = 12

# Name columns are mostly unique; below this distinct ratio the values look
# like a category (marital status, department) whatever the header suggests.
_NAME_MIN_RATIO = 0.5

_VALUE_THRESHOLD = 0.8

# Prose is a looser claim than a structural type: half a column of sentences is
# enough to prefer generating new text over memorizing the originals.
FREE_TEXT_MIN_LEN = 60
FREE_TEXT_MIN_WORDS = 6
FREE_TEXT_RATIO = 0.5

# Structural types whose checker can vouch for a value on its own. Used to
# sanity-check model-proposed types against the actual values.
_FORMAT_CHECKS: dict[DetectedType, Callable[[str], bool]] = {
    "NRIC": _is_nric,
    "PASSPORT": _is_passport,
    "DRIVING_LICENSE": _is_driving_license,
    "CARD": _is_card,
    "PHONE": lambda value: _is_phone(value, allow_bare=True),
    "EMAIL": _is_email,
    "URL": _is_url,
    "IP_ADDRESS": _is_ip,
    "GENDER": _is_gender,
    "AGE": _is_age,
    "DOB": _is_date,
    "DATE": _is_date,
}


def samples_support_type(detected_type: DetectedType, values: list[str]) -> bool:
    """Whether the column's values structurally support ``detected_type``.

    True for every type without a structural checker, so callers fall back to
    trusting the answer. Empty columns can't contradict anything either.
    """
    present = [value for value in values if value]
    if not present:
        return True
    checker = _FORMAT_CHECKS.get(detected_type)
    if checker is not None:
        return any(checker(value) for value in present)
    if detected_type == "NAME":
        return len(set(present)) / len(present) >= _NAME_MIN_RATIO
    return True


def samples_look_personal(values: list[str]) -> bool:
    """Whether any value contains a direct identifier (email, NRIC, phone).

    Searches inside free text, e.g. a comments column whose rows mention
    contact details; catches PII the header and type cannot see.
    """
    for value in values:
        if not value:
            continue
        if _EMAIL_IN_TEXT_RE.search(value) or NRIC_RE.search(
            value.upper().replace(" ", "")
        ):
            return True
        for match in _PHONE_IN_TEXT_RE.finditer(value):
            if 7 <= len(re.sub(r"\D", "", match.group())) <= 15:
                return True
    return False


# ---------------------------------------------------------------------------
# Sensitivity
# ---------------------------------------------------------------------------

_TYPE_SENSITIVITY: dict[DetectedType, Sensitivity] = {
    "NRIC": "PII",
    "PASSPORT": "PII",
    "DRIVING_LICENSE": "PII",
    "NAME": "PII",
    "PHONE": "PII",
    "EMAIL": "PII",
    "URL": "PII",
    "IP_ADDRESS": "PII",
    "CARD": "SENSITIVE",
    "DOB": "INDIRECT_PII",
    "DATE": "INDIRECT_PII",
    "AGE": "INDIRECT_PII",
    "GENDER": "INDIRECT_PII",
    "ADDRESS": "INDIRECT_PII",
    "TITLE": "INDIRECT_PII",
    # Shape-only types. Sensitivity is settled by policy (header) or Laya, so
    # a numeric age column without an age header can still become INDIRECT_PII.
    "NUMERIC": "UNKNOWN",
    "TEXT": "UNKNOWN",
    "UNKNOWN": "UNKNOWN",
}

_SENSITIVE_HEADERS = (
    "salary",
    "compensation",
    "income",
    "wage",
    "bonus",
    "allowance",
    "stipend",
    "payroll",
    "payout",
    "medical",
    "health",
    "diagnosis",
    "treatment",
    "medication",
    "patient",
    "religion",
    "religious",
    "ethnicity",
    "ethnic",
    "race",
    "racial",
    "biometric",
    "blood",
    "criminal",
    "bank",
    "account",
    "credit",
    "financial",
)

_PII_HEADERS = (
    "passport",
    "nric",
    "fin",
    "nationalid",
    "icnumber",
    "tax",
    "tin",
    "socialsecurity",
    "license",
)

_INDIRECT_HEADERS = (
    "postal",
    "postcode",
    "zip",
    "city",
    "town",
    "country",
    "nationality",
    "birthdate",
    "birthday",
    "dob",
    "marital",
    "occupation",
    "education",
    "employment",
    "department",
)


def _contains_any(header: str | None, terms: tuple[str, ...]) -> bool:
    candidates = _header_candidates(header)
    return any(term in candidates for term in terms)


def classify_sensitivity(header: str | None, detected_type: DetectedType) -> Sensitivity:
    if _contains_any(header, _SENSITIVE_HEADERS):
        return "SENSITIVE"
    if _contains_any(header, _PII_HEADERS):
        return "PII"
    if _contains_any(header, _INDIRECT_HEADERS) or _is_age_header(header):
        return "INDIRECT_PII"
    return _TYPE_SENSITIVITY.get(detected_type, "UNKNOWN")


# ---------------------------------------------------------------------------
# Column detection
# ---------------------------------------------------------------------------


def detect_column(
    header: str | None, values: list[str]
) -> tuple[DetectedType, Sensitivity, float, list[str]]:
    """Return (type, sensitivity, confidence, unique_samples) for a column."""
    hint = header_hint(header)
    samples = [value for value in values if value]
    unique_values = list(dict.fromkeys(samples))
    unique_samples = unique_values[:3]

    if not samples:
        detected_type = hint or "UNKNOWN"
        confidence = 0.5 if hint else 0.0
        return (
            detected_type,
            classify_sensitivity(header, detected_type),
            round(confidence, 2),
            unique_samples,
        )

    identifier_header = _is_identifier_header(header)
    checkers = [
        (detected_type, checker_name)
        for detected_type, checker_name in _VALUE_CHECKS
        if not (
            detected_type in _HINT_GATED and detected_type != hint
        )
        and not (detected_type == "NUMERIC" and identifier_header)
        and not (
            detected_type == "NAME"
            and hint != "NAME"
            and len(unique_values) < _NAME_MIN_UNIQUE
        )
    ]

    counters = Counter()
    for value in samples:
        for detected_type, checker_name in checkers:
            if detected_type == "PHONE":
                matched = _is_phone(value, allow_bare=hint == "PHONE")
            else:
                matched = bool(globals()[checker_name](value))
            if matched:
                counters[detected_type] += 1

    total = len(samples)
    ratios = {
        detected_type: counters[detected_type] / total
        for detected_type, _ in checkers
        if detected_type in counters or detected_type == hint
    }
    if not ratios:
        ratios["UNKNOWN"] = 0.0

    best_type = max(ratios, key=ratios.get)
    best_ratio = ratios[best_type]

    # DOB and DATE share a value checker; the header decides which one.
    if best_type in ("DOB", "DATE"):
        best_type = hint if hint in ("DOB", "DATE") else "DATE"

    threshold = (
        FREE_TEXT_RATIO if best_type == "TEXT" else _VALUE_THRESHOLD
    )
    if best_ratio >= threshold:
        confidence = min(0.99, 0.6 + best_ratio * 0.4)
        return (
            best_type,
            classify_sensitivity(header, best_type),
            round(confidence, 2),
            unique_samples,
        )

    if hint:
        confidence = min(0.85, 0.5 + ratios.get(hint, 0.0) * 0.4)
        return (
            hint,
            classify_sensitivity(header, hint),
            round(confidence, 2),
            unique_samples,
        )

    return (
        "UNKNOWN",
        classify_sensitivity(header, "UNKNOWN"),
        round(best_ratio, 2),
        unique_samples,
    )