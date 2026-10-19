"""Default column action policy: sensitivity x categorizability.

Product decision (the "matrix"):

* PII / INDIRECT_PII / SENSITIVE + categorizable     -> ``k_anonymity``
* PII / INDIRECT_PII / SENSITIVE + not categorizable  -> ``synthetic``
* NON_SENSITIVE (or a sensitivity we could not settle) -> ``keep``

Categorizability means "values can be turned into equivalence classes without
being destroyed": known types declare it directly, and UNKNOWN columns fall back
to value shape -- binnable samples (numeric/date-shaped) or groupable ones (low
cardinality, not free text). Columns with no samples always default to ``keep``:
there is nothing to group and nothing Laya could judge.
"""

from __future__ import annotations

import re
from datetime import datetime

from src.datasets.detection import DATE_FORMATS

# Types whose values bin or generalize into categories: ranges for AGE,
# year bands for DOB/DATE, hierarchy for ADDRESS, job-family groups for TITLE,
# value groups for GENDER.
_CATEGORIZABLE_TYPES = frozenset(
    {"AGE", "TITLE", "GENDER", "DOB", "DATE", "ADDRESS"}
)

# Direct identifiers: one distinct value per person, so grouping them is
# masking, not categorization.
_IDENTIFIER_TYPES = frozenset(
    {
        "NRIC",
        "PASSPORT",
        "DRIVING_LICENSE",
        "CARD",
        "PHONE",
        "EMAIL",
        "URL",
        "IP_ADDRESS",
        "NAME",
    }
)

_SENSITIVE_CLASSES = frozenset({"PII", "INDIRECT_PII", "SENSITIVE"})

# UNKNOWN-type fallbacks.
_BINNABLE_RATIO = 0.6
_GROUPABLE_DISTINCT_MAX = 20
# Average group size >= 2 (distinct / n <= 0.5): the column repeats values, so
# k>=2 equivalence classes actually exist. An all-unique column needs masking
# even when there are few distinct values.
_GROUPABLE_RATIO = 0.5
# Share of samples longer than this that marks a column as free text, which
# cannot be grouped into meaningful categories even when cardinality is low.
_FREE_TEXT_LEN = 60
_FREE_TEXT_RATIO = 0.5

_CURRENCY_CHARS = "$€£¥¤ "
_NUMERIC_WITH_DECIMAL = re.compile(r"^-?\d+(?:\.\d+)?$")
_NUMERIC_WITH_THOUSANDS = re.compile(r"^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$")


def _is_binnable(value: str) -> bool:
    candidate = value.strip().rstrip("%").replace(" ", "").strip()
    if not candidate:
        return False
    candidate = candidate.lstrip(_CURRENCY_CHARS).rstrip(_CURRENCY_CHARS)
    if _NUMERIC_WITH_DECIMAL.match(candidate) or _NUMERIC_WITH_THOUSANDS.match(
        candidate
    ):
        return True
    for fmt in DATE_FORMATS:
        try:
            datetime.strptime(candidate, fmt)
            return True
        except ValueError:
            continue
    return False


def is_categorizable(detected_type: str, samples: list[str]) -> bool:
    """Whether this column's values can be grouped/binned for K-anonymity."""
    if detected_type in _CATEGORIZABLE_TYPES:
        return True
    if detected_type in _IDENTIFIER_TYPES:
        return False
    if not samples:
        return False

    binnable = sum(1 for value in samples if _is_binnable(value)) / len(samples)
    if binnable >= _BINNABLE_RATIO:
        return True

    long_text = sum(1 for value in samples if len(value) > _FREE_TEXT_LEN)
    if long_text / len(samples) >= _FREE_TEXT_RATIO:
        return False

    distinct = len(set(samples))
    return distinct <= _GROUPABLE_DISTINCT_MAX and (
        distinct / len(samples) <= _GROUPABLE_RATIO
    )


def column_action(
    detected_type: str, sensitivity: str, samples: list[str]
) -> str:
    """Default action for a column under the sensitivity x categorizability matrix."""
    if not samples or sensitivity not in _SENSITIVE_CLASSES:
        # No values to group, or a non-sensitive / unsettled sensitivity:
        # Laya decided "non_sensitive", or it could not decide and we fell back.
        return "keep"
    if is_categorizable(detected_type, samples):
        return "k_anonymity"
    return "synthetic"
