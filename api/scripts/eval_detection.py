"""Detection eval: heuristic baseline vs heuristic+Laya against hand labels.

Usage (from api/):
    uv run python scripts/eval_detection.py          # heuristic only
    uv run python scripts/eval_detection.py --laya   # before/after in one run

Labels live in scripts/fixtures/columns_labeled.json: each entry names a
column (header + sample values) with its true type, sensitivity and default
action. The script runs detect_column (+ column_action) exactly the way
service.create_dataset does, optionally consulting laya-serve, and scores
all three fields.
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from src.datasets import actions, laya_detection  # noqa: E402
from src.datasets.detection import detect_column  # noqa: E402

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "columns_labeled.json"
FIELDS = (
    ("type", "expected_type", "detected_type"),
    ("sensitivity", "expected_sensitivity", "sensitivity"),
    ("action", "expected_action", "action"),
)


def _build() -> tuple[list[dict], list[dict], list[list[str]]]:
    entries = json.loads(FIXTURE.read_text(encoding="utf-8"))
    columns: list[dict] = []
    samples: list[list[str]] = []
    for entry in entries:
        detected_type, sensitivity, confidence, _samples = detect_column(
            entry["header"], entry["values"]
        )
        columns.append(
            {
                "index": len(columns),
                "header": entry["header"],
                "detected_type": detected_type,
                "sensitivity": sensitivity,
                "confidence": confidence,
            }
        )
        samples.append(entry["values"])
    return entries, columns, samples


def _apply_actions(columns: list[dict], samples: list[list[str]]) -> None:
    for index, column in enumerate(columns):
        column["action"] = actions.column_action(
            column["detected_type"], column["sensitivity"], samples[index]
        )


def _score(entries: list[dict], columns: list[dict]) -> dict[str, int]:
    totals = {label: 0 for label, _, _ in FIELDS}
    for entry, column in zip(entries, columns):
        for label, expected_key, got_key in FIELDS:
            if entry[expected_key] == column[got_key]:
                totals[label] += 1
    return totals


def _misses(entries: list[dict], columns: list[dict]) -> list[str]:
    lines = []
    for entry, column in zip(entries, columns):
        wrong = [
            f"{label}: got {column[got_key]}, expected {entry[expected_key]}"
            for label, expected_key, got_key in FIELDS
            if entry[expected_key] != column[got_key]
        ]
        if wrong:
            lines.append(f"  - {entry['name']}: " + "; ".join(wrong))
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--laya",
        action="store_true",
        dest="with_laya",
        help="also evaluate heuristic+Laya and print the before/after table",
    )
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8000",
        help="laya-serve base URL (default: %(default)s)",
    )
    parser.add_argument(
        "--timeout", type=float, default=30.0, help="per-call timeout (s)"
    )
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    entries, columns, samples = _build()
    _apply_actions(columns, samples)

    rows: list[tuple[str, dict[str, int]]] = [
        ("heuristic", _score(entries, columns))
    ]

    if args.with_laya:
        laya_columns = copy.deepcopy(columns)
        stats = laya_detection.enhance_columns(
            laya_columns,
            samples,
            base_url=args.url,
            enabled=True,
            min_confidence=0.5,
            timeout=args.timeout,
        )
        _apply_actions(laya_columns, samples)
        rows.append(("heuristic+laya", _score(entries, laya_columns)))
    else:
        laya_columns = None

    print(f"=== detection eval: {len(entries)} labeled columns ===")
    print(f"{'mode':<16}{'type':>10}{'sensitivity':>15}{'action':>10}")
    for mode, score in rows:
        parts = [
            f"{score[label]}/{len(entries)}" for label, _, _ in FIELDS
        ]
        print(f"{mode:<16}{parts[0]:>10}{parts[1]:>15}{parts[2]:>10}")

    if laya_columns is not None:
        print(f"\nlaya consults: {stats}")

    print("\nheuristic misses:")
    for line in _misses(entries, columns):
        print(line)

    if laya_columns is not None:
        print("\nheuristic+laya misses:")
        for line in _misses(entries, laya_columns):
            print(line)


if __name__ == "__main__":
    main()
