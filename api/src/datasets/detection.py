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
    {"age", "ageyears", "yearsofage", "agegroup", "ageband", "agerange"}
)

ADDRESS_RE = re.compile(
    r"\b(blk|block|street|st|road|rd|avenue|ave|lane|drive|crescent|close|walk|"
    r"place|terrace|floor|unit|boulevard|blvd|way|singapore|sector|district)\b|"
    r"#|\b\d{6}\b",
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
    (("url", "website", "web", "link", "domain"), "URL"),
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


def header_hint(header: str | None) -> DetectedType | None:
    if not header:
        return None
    normalized = re.sub(r"[^a-z0-9]", "", str(header).lower())
    if not normalized:
        return None
    if _is_age_header(header):
        return "AGE"
    for keys, detected_type in HEADER_HINTS:
        if any(key in normalized for key in keys):
            return detected_type
    return None


def _is_nric(value: str) -> bool:
    return bool(NRIC_RE.match(value.upper().replace(" ", "")))


def _is_age_header(header: str | None) -> bool:
    if not header:
        return False
    text = str(header).lower()
    if re.sub(r"[^a-z0-9]", "", text) in _AGE_HEADERS:
        return True
    return "age" in re.split(r"[^a-z0-9]+", text)


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
# also look like dashed phone numbers. ``NAME`` stays last since it is the
# broadest, and is additionally gated on cardinality (below).
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

_VALUE_THRESHOLD = 0.8


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
)


def _contains_any(header: str | None, terms: tuple[str, ...]) -> bool:
    if not header:
        return False
    normalized = re.sub(r"[^a-z0-9]", "", str(header).lower())
    return any(term in normalized for term in terms)


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

    checkers = [
        (detected_type, checker_name)
        for detected_type, checker_name in _VALUE_CHECKS
        if not (
            detected_type in _HINT_GATED and detected_type != hint
        )
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

    if best_ratio >= _VALUE_THRESHOLD:
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