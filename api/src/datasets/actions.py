"""Default column action policy: sensitivity x categorizability.

Product decision (the "matrix"):

* INDIRECT_PII / SENSITIVE + categorizable      -> ``generalize``
* INDIRECT_PII / SENSITIVE + not categorizable  -> ``redact``
* NON_SENSITIVE (or a sensitivity we could not settle) -> ``keep``

Column-level actions are per-column only. Dataset-wide methods (k-anonymity,
synthetic generation) are chosen separately in the output step, not here.

Categorizability means "values can be turned into equivalence classes without
being destroyed": known types declare it directly, and UNKNOWN columns fall back
to value shape -- binnable samples (numeric/date-shaped) or groupable ones (low
cardinality, not free text). Columns with no samples always default to ``keep``:
there is nothing to group and nothing Laya could judge.
"""

from __future__ import annotations

from src.datasets.detection import (
    FREE_TEXT_RATIO,
    is_binnable,
    is_free_text,
    parse_number,
)

# Types whose values bin or generalize into categories: ranges for AGE and
# NUMERIC, year bands for DOB/DATE, hierarchy for ADDRESS, job-family groups
# for TITLE, value groups for GENDER.
_CATEGORIZABLE_TYPES = frozenset(
    {"AGE", "NUMERIC", "TITLE", "GENDER", "DOB", "DATE", "ADDRESS"}
)

# Direct identifiers: one distinct value per person, so grouping them is
# masking, not categorization. Free text is prose, so it cannot be grouped
# into meaningful equivalence classes either.
_NON_CATEGORIZABLE_TYPES = frozenset(
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
        "TEXT",
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


def is_categorizable(detected_type: str, samples: list[str]) -> bool:
    """Whether this column's values can be grouped/binned for K-anonymity."""
    if detected_type in _CATEGORIZABLE_TYPES:
        return True
    if detected_type in _NON_CATEGORIZABLE_TYPES:
        return False
    if not samples:
        return False

    binnable = sum(1 for value in samples if is_binnable(value)) / len(samples)
    if binnable >= _BINNABLE_RATIO:
        return True

    free_text = sum(1 for value in samples if is_free_text(value))
    if free_text / len(samples) >= FREE_TEXT_RATIO:
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
        return "generalize"
    return "redact"
