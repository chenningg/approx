"""Filesystem storage for uploaded datasets.

Layout::

    {data_dir}/datasets/{dataset_id}/
        original{suffix}   # the uploaded workbook
        meta.json          # columns, counts, sheet names
        rows.jsonl         # normalized rows, one JSON array per line
"""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from src.config import config


def _root() -> Path:
    root = Path(config.data_dir) / "datasets"
    root.mkdir(parents=True, exist_ok=True)
    return root


def dataset_dir(dataset_id: UUID | str) -> Path:
    return _root() / str(dataset_id)


def original_path(dataset_id: UUID | str, suffix: str) -> Path:
    return dataset_dir(dataset_id) / f"original{suffix}"


def meta_path(dataset_id: UUID | str) -> Path:
    return dataset_dir(dataset_id) / "meta.json"


def rows_path(dataset_id: UUID | str) -> Path:
    return dataset_dir(dataset_id) / "rows.jsonl"


def exists(dataset_id: UUID | str) -> bool:
    return meta_path(dataset_id).is_file()
