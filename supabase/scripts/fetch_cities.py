#!/usr/bin/env python3
"""
Transform worldcities.csv into cities_seed.json for Supabase seeding.
Cleans and normalizes CSV values to match the cities table schema.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

INPUT_FILE = Path(__file__).parent.parent / "data" / "worldcities.csv"
OUTPUT_FILE = Path(__file__).parent.parent / "data" / "cities_seed.json"


def parse_float(value: str) -> float | None:
    """Parse a numeric string as float, returning None when empty/invalid."""
    text = value.strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_population(value: str) -> int | None:
    """Parse population as integer, returning None when empty/invalid."""
    text = value.strip()
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def parse_is_capital(value: str) -> bool:
    """Only country capitals are marked as true in schema semantics."""
    return value.strip().lower() == "primary"


def normalize_row(row: dict[str, str]) -> dict[str, Any] | None:
    """Map a worldcities CSV row to cities_seed JSON shape."""
    simplemaps_id = row.get("id", "").strip()
    name = row.get("city", "").strip()
    name_ascii = row.get("city_ascii", "").strip() or None
    country_iso_code_2 = row.get("iso2", "").strip().upper()

    latitude = parse_float(row.get("lat", ""))
    longitude = parse_float(row.get("lng", ""))

    # Required DB fields must exist for a valid row.
    if not simplemaps_id or not name or not country_iso_code_2:
        return None
    if latitude is None or longitude is None:
        return None

    return {
        "simplemaps_id": simplemaps_id,
        "name": name,
        "name_ascii": name_ascii,
        "country_iso_code_2": country_iso_code_2,
        "is_capital": parse_is_capital(row.get("capital", "")),
        "admin_name": row.get("admin_name", "").strip() or None,
        "population": parse_population(row.get("population", "")),
        "latitude": latitude,
        "longitude": longitude,
    }


def load_and_transform() -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Load CSV and build normalized city records with stats."""
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Input CSV not found: {INPUT_FILE}")

    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    stats = {
        "rows_total": 0,
        "rows_invalid": 0,
        "rows_duplicate_id": 0,
        "rows_output": 0,
    }

    with open(INPUT_FILE, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for raw_row in reader:
            stats["rows_total"] += 1
            normalized = normalize_row(raw_row)

            if normalized is None:
                stats["rows_invalid"] += 1
                continue

            city_id = normalized["simplemaps_id"]
            if city_id in seen_ids:
                stats["rows_duplicate_id"] += 1
                continue

            seen_ids.add(city_id)
            rows.append(normalized)

    rows.sort(key=lambda r: (r["country_iso_code_2"], r["name_ascii"] or r["name"], r["simplemaps_id"]))
    stats["rows_output"] = len(rows)
    return rows, stats


def main() -> int:
    print("=== Travel Book Cities Fetcher ===\n")

    try:
        cities, stats = load_and_transform()

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(cities, f, indent=2, ensure_ascii=False)

        print(f"✓ Saved {stats['rows_output']} cities to {OUTPUT_FILE.name}")
        print("\nSummary:")
        print(f"  CSV rows read: {stats['rows_total']}")
        print(f"  Invalid rows skipped: {stats['rows_invalid']}")
        print(f"  Duplicate simplemaps_id skipped: {stats['rows_duplicate_id']}")
        print(f"  Final cities output: {stats['rows_output']}")

    except Exception as e:
        print(f"✗ Fatal error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
