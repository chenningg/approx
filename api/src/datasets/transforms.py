"""Value transforms applied when a dataset is processed.

Parity port of the frontend preview transforms
(``frontend/src/features/datasets/masking.ts`` and ``generalize.ts``): the
preview and the exported file must show identical values, so any behaviour
change here needs a matching change there (and vice versa).
"""

from __future__ import annotations

import math
import re

from src.datasets.actions import parse_number

_SPACE_RE = re.compile(r"\s")
_ALNUM_RE = re.compile(r"[A-Za-z0-9]")
_YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
_URL_RE = re.compile(r"^(https?://)?([^/?#]+)", re.IGNORECASE)

_MONTH_NAMES = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

_YEAR_FIRST_RE = re.compile(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$")
_DAY_FIRST_RE = re.compile(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$")
_DAY_NAME_RE = re.compile(r"^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$")
_NAME_DAY_RE = re.compile(r"^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$")


def _is_space(char: str) -> bool:
    return bool(_SPACE_RE.match(char))


def _mask_non_space(value: str, keep_start: int, keep_end: int) -> str:
    chars = list(value)
    positions = [index for index, char in enumerate(chars) if not _is_space(char)]
    total = len(positions)
    mask_count = max(0, total - keep_start - keep_end)
    for order in range(keep_start, keep_start + mask_count):
        chars[positions[order]] = "*"
    return "".join(chars)


def _round_half_up(value: float) -> int:
    """Match the frontend's Math.round (ties toward +infinity)."""
    return math.floor(value + 0.5)


def _mask_trailing(value: str, percentage: int) -> str:
    total = sum(1 for char in value if not _is_space(char))
    if total == 0:
        return value
    if percentage >= 100:
        count = total
    else:
        count = max(1, _round_half_up(total * percentage / 100))
    return _mask_non_space(value, total - count, 0)


def _mask_email(value: str) -> str:
    at = value.find("@")
    if at <= 0 or at == len(value) - 1:
        return _mask_non_space(value, 0, 0)
    return f"{value[0]}***{value[at:]}"


def _mask_url(value: str) -> str:
    match = _URL_RE.match(value)
    if not match:
        return _mask_non_space(value, 0, 0)
    scheme = match.group(1) or ""
    host = match.group(2)
    dot = host.rfind(".")
    if dot <= 0:
        return f"{scheme}{_mask_non_space(host, 0, 0)}"
    return f"{scheme}****{host[dot:]}"


def _mask_ip(value: str) -> str:
    parts = value.split(".")
    if len(parts) != 4:
        return _mask_non_space(value, 0, 0)
    return f"***.***.***.{parts[3]}"


def _mask_date(value: str) -> str:
    match = _YEAR_RE.search(value)
    if not match:
        return _mask_non_space(value, 0, 0)
    start, end = match.span()
    return "".join(
        char
        if not _ALNUM_RE.match(char) or (start <= index < end)
        else "*"
        for index, char in enumerate(value)
    )


def mask_value(
    detected_type: str,
    value: str | None,
    mode: str,
    percentage: int,
) -> str | None:
    if value is None:
        return None
    if value.strip() == "":
        return value
    if mode == "custom":
        return _mask_trailing(value, percentage)
    if detected_type == "EMAIL":
        return _mask_email(value)
    if detected_type == "URL":
        return _mask_url(value)
    if detected_type == "IP_ADDRESS":
        return _mask_ip(value)
    if detected_type in ("DOB", "DATE"):
        return _mask_date(value)
    if detected_type in ("PHONE", "CARD"):
        return _mask_non_space(value, 0, 4)
    if detected_type in ("NRIC", "PASSPORT", "DRIVING_LICENSE"):
        return _mask_non_space(value, 1, 4)
    return _mask_non_space(value, 0, 0)


def numeric_bounds(
    column_meta: dict,
) -> tuple[float, float] | None:
    low = column_meta.get("numeric_min")
    high = column_meta.get("numeric_max")
    if low is not None and high is not None:
        return float(low), float(high)
    numbers = [
        number
        for number in (
            parse_number(value)
            for value in column_meta.get("sample_values", [])
        )
        if number is not None
    ]
    if not numbers:
        return None
    return min(numbers), max(numbers)


def format_bound(value: float) -> str:
    if value.is_integer():
        return f"{int(value):,}"
    if value >= 0:
        rounded = math.floor(value * 100 + 0.5) / 100
    else:
        rounded = math.ceil(value * 100 - 0.5) / 100
    if rounded == 0:
        return "0"
    if rounded.is_integer():
        return f"{int(rounded):,}"
    return f"{rounded:.2f}".rstrip("0").rstrip(".")


def _numeric_bucket_label(
    minimum: float, maximum: float, buckets: int, value: float
) -> str:
    count = max(1, math.floor(buckets))
    if maximum <= minimum:
        return format_bound(minimum)
    width = (maximum - minimum) / count
    whole_range = (
        minimum.is_integer() and maximum.is_integer() and width >= 1
    )
    edges = [
        float(_round_half_up(minimum + index * width)) if whole_range
        else minimum + index * width
        for index in range(count + 1)
    ]
    clamped = min(max(value, minimum), maximum)
    bucket = count - 1
    for index in range(count):
        if clamped < edges[index + 1]:
            bucket = index
            break
    lower, upper = edges[bucket], edges[bucket + 1]
    if whole_range and bucket < count - 1:
        return f"{format_bound(lower)}-{format_bound(upper - 1)}"
    return f"{format_bound(lower)}-{format_bound(upper)}"


def _age_band_label(band: int, age: float) -> str:
    width = max(1, math.floor(band))
    start = math.floor(age / width) * width
    return f"{start}-{start + width - 1}"


def _make_parts(year: int, month: int, day: int) -> tuple[int, int] | None:
    if month < 1 or month > 12 or day < 1 or day > 31:
        return None
    return year, month


def _parse_date_parts(value: str) -> tuple[int, int] | None:
    text = value.strip()

    match = _YEAR_FIRST_RE.match(text)
    if match:
        return _make_parts(int(match[1]), int(match[2]), int(match[3]))

    match = _DAY_FIRST_RE.match(text)
    if match:
        return _make_parts(int(match[3]), int(match[2]), int(match[1]))

    match = _DAY_NAME_RE.match(text)
    if match:
        month = _MONTH_NAMES.get(match[2].lower())
        return (
            _make_parts(int(match[3]), month, int(match[1])) if month else None
        )

    match = _NAME_DAY_RE.match(text)
    if match:
        month = _MONTH_NAMES.get(match[1].lower())
        return (
            _make_parts(int(match[3]), month, int(match[2])) if month else None
        )

    return None


def _dob_range_label(parts: tuple[int, int], width: str) -> str:
    year, month = parts
    if width == "month":
        return f"{year}-{month:02d}"
    if width == "quarter":
        return f"{year}-Q{(month - 1) // 3 + 1}"
    if width == "decade":
        start = (year // 10) * 10
        return f"{start}-{start + 9}"
    return str(year)


def generalize_value(
    column_meta: dict,
    value: str | None,
    method: str,
    age_band: int,
    dob_width: str,
    buckets: int,
) -> str | None:
    if value is None:
        return None
    if value.strip() == "":
        return value
    if method == "age":
        age = parse_number(value)
        return _age_band_label(age_band, age) if age is not None else value
    if method == "dob":
        parts = _parse_date_parts(value)
        return _dob_range_label(parts, dob_width) if parts else value
    number = parse_number(value)
    bounds = numeric_bounds(column_meta)
    if number is None or bounds is None:
        return value
    return _numeric_bucket_label(bounds[0], bounds[1], buckets, number)
