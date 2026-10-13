"""Heuristic PII detection for dataset columns.

Detection blends header-name hints with value-shape heuristics evaluated over a
capped sample of non-empty values. It returns the most likely type along with a
confidence score, falling back to ``UNKNOWN`` when nothing stands out.
"""

from __future__ import annotations

import re
from datetime import datetime

DetectedType = str

NRIC_RE = re.compile(r"^[STFGM]\d{7}[A-Z]$")
CARD_RE = re.compile(r"^\d{13,19}$")

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

ADDRESS_RE = re.compile(
    r"\b(blk|block|street|st|road|rd|avenue|ave|lane|drive|crescent|close|walk"
    r"|place|terrace|floor|unit|singapore|sector|district)\b|#|\b\d{6}\b",
    re.IGNORECASE,
)

# Specific types first. ``name`` is intentionally last since it is the broadest.
HEADER_HINTS: tuple[tuple[tuple[str, ...], DetectedType], ...] = (
    (("nric", "fin", "identitycard", "nationalid", "icnumber"), "NRIC"),
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
    (("dob", "dateofbirth", "birthdate", "birthday"), "DOB"),
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
    (("name",), "NAME"),
)

CHECK_ORDER: tuple[tuple[DetectedType, str], ...] = (
    ("NRIC", "_is_nric"),
    ("CARD", "_is_card"),
    ("DOB", "_is_date"),
    ("GENDER", "_is_gender"),
    ("ADDRESS", "_is_address"),
    ("NAME", "_is_name"),
)


def header_hint(header: str | None) -> DetectedType | None:
    if not header:
        return None
    normalized = re.sub(r"[^a-z0-9]", "", str(header).lower())
    if not normalized:
        return None
    for keys, detected_type in HEADER_HINTS:
        if any(key in normalized for key in keys):
            return detected_type
    return None


def _is_nric(value: str) -> bool:
    return bool(NRIC_RE.match(value.upper().replace(" ", "")))


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


_VALUE_CHECKS = {
    "NRIC": _is_nric,
    "CARD": _is_card,
    "DOB": _is_date,
    "GENDER": _is_gender,
    "ADDRESS": _is_address,
    "NAME": _is_name,
}

_VALUE_THRESHOLD = 0.8


def _ratio(values: list[str], predicate) -> float:
    if not values:
        return 0.0
    return sum(1 for value in values if predicate(value)) / len(values)


def detect_column(
    header: str | None, values: list[str]
) -> tuple[DetectedType, float, list[str]]:
    hint = header_hint(header)
    samples = [value for value in values if value]
    unique_samples = list(dict.fromkeys(samples))[:3]

    if not samples:
        return (hint or "UNKNOWN", 0.5 if hint else 0.0, unique_samples)

    ratios = {
        detected_type: _ratio(samples, _VALUE_CHECKS[detected_type])
        for detected_type, _ in CHECK_ORDER
    }
    best_type = max(CHECK_ORDER, key=lambda item: ratios[item[0]])[0]
    best_ratio = ratios[best_type]

    if best_ratio >= _VALUE_THRESHOLD:
        confidence = min(0.99, 0.6 + best_ratio * 0.4)
        return best_type, round(confidence, 2), unique_samples

    if hint:
        confidence = min(0.85, 0.5 + ratios.get(hint, 0.0) * 0.4)
        return hint, round(confidence, 2), unique_samples

    return "UNKNOWN", round(best_ratio, 2), unique_samples
