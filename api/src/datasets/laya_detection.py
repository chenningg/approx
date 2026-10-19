"""Consult laya-serve for columns the heuristics could not classify.

``detect_column`` is deterministic and wins wherever it is confident. This
module runs after it and asks the HTTP server only about uncertain columns:

* ``detected_type == "UNKNOWN"``        - Laya maps the column onto the known
  type taxonomy, or answers ``UNKNOWN`` and it stays unknown.
* ``detected_type`` known but low confidence - Laya may confirm or replace it.
* ``sensitivity == "UNKNOWN"``          - Laya classifies PII / INDIRECT_PII /
  SENSITIVE / NON_SENSITIVE. This is what catches PII hidden in free text.

Sensitivity is settled by policy where policy can settle it: the header/type
table in ``detection.classify_sensitivity`` wins whenever it yields anything but
UNKNOWN, so Laya only fills gaps and never contradicts policy. Every answer is
gated on ``min_confidence``; abstentions, timeouts and connection failures keep
the heuristic result, and a dead server degrades the upload to heuristics-only
without failing it.
"""

from __future__ import annotations

import time
from collections import Counter

from loguru import logger
from laya_client import (
    LayaClient,
    LayaConnectionError,
    LayaError,
)

from src.datasets.detection import (
    classify_sensitivity,
    header_hint,
    samples_look_personal,
    samples_support_type,
)

# Below this, a heuristic type is "uncertain" and Laya is asked to confirm it.
UNCERTAIN_CONFIDENCE = 0.6

# State stays small: the server truncates at its own budget, and 8 samples are
# plenty to read a column's shape. Repeated values carry their count so the
# model can tell a low-cardinality category column from unique values.
SAMPLES_PER_STATE = 8
MAX_SAMPLE_CHARS = 120

_TYPE_QUESTION = {
    "type": "choice",
    "instructions": (
        "Classify this spreadsheet column from its header and sample values. "
        "Choose UNKNOWN unless the sample values clearly match one type: "
        "status words, department names, codes, amounts and remarks are UNKNOWN."
    ),
    "criteria": {
        "NRIC": "Singapore NRIC or FIN: a letter, 7 digits, then a letter, like S1234567A",
        "PASSPORT": "passport number",
        "DRIVING_LICENSE": "driving licence number",
        "CARD": "credit or debit card number, 13 to 19 digits",
        "PHONE": "phone or mobile number, digits with + or spaces",
        "EMAIL": "an email address like user@example.com",
        "URL": "a website URL starting with http or www",
        "IP_ADDRESS": "IPv4 or IPv6 network address",
        "DOB": "date of birth or birth date",
        "DATE": "dates or timestamps such as joined, created, updated",
        "AGE": "age in whole years",
        "GENDER": "gender or sex",
        "TITLE": "job title or role such as Software Engineer, Sales Director",
        "ADDRESS": "postal or street address",
        "NAME": "personal names of people",
        "UNKNOWN": (
            "none of these: employment status, department, marital status, "
            "nationality, education, salaries, amounts, percentages, bank "
            "account numbers, employee or row codes, remarks and other free text"
        ),
    },
}

_SENSITIVITY_QUESTION = {
    "type": "choice",
    "instructions": (
        "Classify what kind of personal information this spreadsheet column "
        "contains, so the dataset can be released without harming the people "
        "in it. A column that describes a person's circumstances (job, "
        "education, status, age, address) is INDIRECT_PII even when it looks "
        "harmless alone. Only choose NON_SENSITIVE when it is about products, "
        "business figures, or codes that are not attached to a person."
    ),
    "criteria": {
        "PII": (
            "identifiers that single out one person on their own: full "
            "names, national id, phone, email, employee or row codes, bank "
            "account or card numbers, and free text containing phone numbers "
            "or email addresses"
        ),
        "INDIRECT_PII": (
            "narrows identity when combined with other columns but does not "
            "name a person: age, gender, job title, education, department, "
            "employment status, marital status, nationality, address, postcode"
        ),
        "SENSITIVE": "private attributes: salary, health, religion, ethnicity",
        "NON_SENSITIVE": (
            "not about people: sales amounts, prices, discounts, conversion "
            "rates, promotion rates, invoice, order and serial numbers, "
            "product data, remarks with no personal information"
        ),
    },
}

_TYPE_NAMES = frozenset(_TYPE_QUESTION["criteria"])
_SENSITIVITY_NAMES = frozenset(_SENSITIVITY_QUESTION["criteria"])


def _confident(answer: dict | None, gate: float) -> bool:
    if not answer:
        return False
    if answer.get("low_confidence"):
        return False
    # The server's own gate reads answer_confidence (max p); it reports states
    # when we pass min_confidence. ``unevaluated`` means it could not decide.
    abstention = answer.get("abstention")
    if abstention is not None and abstention != "passed":
        return False
    # answer_confidence is the calibrated probability of the reported answer.
    # ``confidence`` is 1 - normalised entropy, which shifts with option count
    # and is not a threshold scale; it is only a fallback for older servers.
    confidence = answer.get("answer_confidence", answer.get("confidence"))
    return isinstance(confidence, (int, float)) and confidence >= gate


def _state(header: str | None, samples: list[str]) -> dict:
    counts = Counter(value for value in samples if value)
    values = [
        f"{value[:MAX_SAMPLE_CHARS]} (x{count})" if count > 1 else value[:MAX_SAMPLE_CHARS]
        for value, count in counts.most_common(SAMPLES_PER_STATE)
    ]
    return {"header": header or "", "values": values}


def _ascii_state(state: dict) -> bool:
    """Whether the state is pure ASCII, i.e. safe for the English checkpoint."""
    text = str(state.get("header", "")) + " ".join(str(v) for v in state["values"])
    return text.isascii()


def enhance_columns(
    columns: list[dict],
    samples: list[list[str]],
    *,
    base_url: str,
    enabled: bool,
    min_confidence: float,
    timeout: float,
    api_key: str | None = None,
) -> dict:
    """Classify uncertain columns via laya-serve, mutating ``columns`` in place.

    Returns counters for logging and the eval harness. Any failure keeps the
    heuristic result for that column.
    """
    stats = {"consulted": 0, "type_overrides": 0, "sensitivity_overrides": 0}
    if not enabled:
        return stats

    targets = [
        index
        for index, column in enumerate(columns)
        if column["detected_type"] == "UNKNOWN"
        or column["sensitivity"] == "UNKNOWN"
        or column["confidence"] < UNCERTAIN_CONFIDENCE
        # NAME without a name-flavoured header is the heuristics' most
        # confident mistake (job titles without a title hint land here).
        or (
            column["detected_type"] == "NAME"
            and header_hint(column.get("header")) != "NAME"
        )
    ]
    if not targets:
        return stats

    client = LayaClient(base_url=base_url, api_key=api_key, timeout=timeout)

    for index in targets:
        column = columns[index]
        header = column.get("header")
        want_type = (
            column["detected_type"] == "UNKNOWN"
            or column["confidence"] < UNCERTAIN_CONFIDENCE
            or (
                column["detected_type"] == "NAME"
                and header_hint(header) != "NAME"
            )
        )
        want_sensitivity = column["sensitivity"] == "UNKNOWN" and not (
            samples_look_personal(samples[index])
        )
        questions: dict = {}
        if want_type:
            questions["type"] = _TYPE_QUESTION
        if want_sensitivity:
            questions["sensitivity"] = _SENSITIVITY_QUESTION

        # The router defaults undecided Latin text to the multilingual
        # checkpoint, which is far weaker at column typing than the English
        # one; ASCII input gets the English checkpoint explicitly, while
        # non-ASCII keeps script-based routing (multilingual for Hindi et al).
        state = _state(header, samples[index])
        predict_kwargs: dict = {"model": "english"} if _ascii_state(state) else {}

        # The first predict after the server idles loads the checkpoint and
        # can outrun the timeout, so a connection failure gets one warm retry
        # before we write the whole server off.
        server_unavailable = False
        result = None
        for attempt in range(2):
            try:
                result = client.predict(
                    state,
                    questions,
                    min_confidence=min_confidence,
                    **predict_kwargs,
                )
                break
            except LayaConnectionError as exc:
                if attempt == 0:
                    time.sleep(2.0)
                    continue
                logger.warning(f"[DATASETS] laya detection unavailable: {exc}")
                server_unavailable = True
            except LayaError as exc:
                logger.warning(
                    f"[DATASETS] laya detection failed for column {index}: {exc}"
                )
                break
        if server_unavailable:
            break
        if result is None:
            continue

        stats["consulted"] += 1
        answers = result.get("answers", {})

        if want_type:
            answer = answers.get("type") or {}
            choice = answer.get("choice")
            # A confident answer the values themselves contradict (CARD for
            # 10-digit account numbers, NRIC for Chinese remarks) is model
            # noise, not a type; the column stays unknown instead.
            if (
                _confident(answer, min_confidence)
                and choice in _TYPE_NAMES
                and choice != "UNKNOWN"
                and choice != column["detected_type"]
                and samples_support_type(choice, samples[index])
            ):
                column["detected_type"] = choice
                column["confidence"] = round(
                    float(
                        answer.get("answer_confidence", answer["confidence"])
                    ),
                    2,
                )
                stats["type_overrides"] += 1

        # Policy (header + final type) first; Laya only where policy is silent,
        # and contact details in the values only ever push a column to PII.
        sensitivity = classify_sensitivity(header, column["detected_type"])
        if sensitivity == "UNKNOWN" and samples_look_personal(samples[index]):
            sensitivity = "PII"
        if sensitivity == "UNKNOWN":
            answer = answers.get("sensitivity") or {}
            choice = answer.get("choice")
            if _confident(answer, min_confidence) and choice in _SENSITIVITY_NAMES:
                sensitivity = choice
        if sensitivity != column["sensitivity"]:
            column["sensitivity"] = sensitivity
            stats["sensitivity_overrides"] += 1

    logger.info(
        "[DATASETS] laya detection: {consulted} columns consulted, "
        "{type_overrides} type overrides, "
        "{sensitivity_overrides} sensitivity updates",
        **stats,
    )
    return stats
