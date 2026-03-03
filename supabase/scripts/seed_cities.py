#!/usr/bin/env python3
"""
Seed cities from cities_seed.json into Supabase.
Maps country_iso_code_2 to countries.id and upserts cities in batches.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

ENV_PATH = Path(__file__).parent.parent.parent / ".env"
DATA_FILE = Path(__file__).parent.parent / "data" / "cities_seed.json"
BATCH_SIZE = 1000

load_dotenv(ENV_PATH)


def load_cities() -> list[dict[str, Any]]:
    """Load normalized cities from JSON file."""
    if not DATA_FILE.exists():
        print(f"✗ File not found: {DATA_FILE}")
        print("  Run fetch_cities.py first")
        return []

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        payload = json.load(f)

    if not isinstance(payload, list):
        print("✗ Invalid cities JSON format: expected a list")
        return []

    return payload


def fetch_country_lookup(supabase_client: Client) -> dict[str, str]:
    """Fetch countries and build iso2 -> country_id map."""
    response = supabase_client.table("countries").select("id, iso_code_2").execute()
    countries = response.data or []

    lookup: dict[str, str] = {}
    for row in countries:
        iso2 = str(row.get("iso_code_2", "")).strip().upper()
        country_id = row.get("id")
        if iso2 and country_id:
            lookup[iso2] = country_id

    return lookup


def map_cities_to_country_ids(cities: list[dict[str, Any]], country_lookup: dict[str, str]) -> tuple[list[dict[str, Any]], dict[str, int], list[str]]:
    """Attach country_id and filter rows that cannot be mapped."""
    rows: list[dict[str, Any]] = []
    unmatched_iso2: set[str] = set()

    stats = {
        "cities_input": len(cities),
        "cities_mapped": 0,
        "cities_unmatched_country": 0,
        "cities_invalid": 0,
    }

    for city in cities:
        iso2 = str(city.get("country_iso_code_2", "")).strip().upper()
        country_id = country_lookup.get(iso2)

        if not iso2 or not country_id:
            stats["cities_unmatched_country"] += 1
            if iso2:
                unmatched_iso2.add(iso2)
            continue

        simplemaps_id = str(city.get("simplemaps_id", "")).strip()
        name = str(city.get("name", "")).strip()
        latitude = city.get("latitude")
        longitude = city.get("longitude")

        if not simplemaps_id or not name or latitude is None or longitude is None:
            stats["cities_invalid"] += 1
            continue

        rows.append(
            {
                "simplemaps_id": simplemaps_id,
                "name": name,
                "name_ascii": city.get("name_ascii"),
                "country_id": country_id,
                "is_capital": bool(city.get("is_capital", False)),
                "admin_name": city.get("admin_name"),
                "population": city.get("population"),
                "latitude": latitude,
                "longitude": longitude,
            }
        )

    stats["cities_mapped"] = len(rows)
    return rows, stats, sorted(unmatched_iso2)


def upsert_cities(supabase_client: Client, rows: list[dict[str, Any]], batch_size: int = BATCH_SIZE) -> bool:
    """Insert city rows in batches for large imports. Clears table first for clean re-seed."""
    if not rows:
        print("✗ No mapped cities to insert")
        return False

    total = len(rows)
    
    # Clear existing cities for clean re-seed
    print("Clearing existing cities...")
    try:
        supabase_client.table("cities").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print("✓ Cities table cleared\n")
    except Exception as e:
        print(f"⚠ Warning clearing table: {e}\n")
    
    print(f"Inserting {total} cities in batches of {batch_size}...")

    try:
        for start in range(0, total, batch_size):
            end = min(start + batch_size, total)
            batch = rows[start:end]
            supabase_client.table("cities").insert(batch).execute()
            print(f"  ✓ Batch {start + 1}-{end} processed")

        print(f"✓ Successfully inserted {total} cities")
        return True
    except Exception as e:
        print(f"✗ Error inserting cities: {e}")
        return False


def main() -> int:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print("✗ Missing environment variables in .env:")
        print("  SUPABASE_URL and SUPABASE_KEY")
        print(f"\nLooking for .env at: {ENV_PATH}")
        return 1

    print("=== Travel Book Cities Seeder ===\n")

    cities = load_cities()
    if not cities:
        return 1

    try:
        supabase = create_client(supabase_url, supabase_key)
        print("✓ Connected to Supabase\n")
    except Exception as e:
        print(f"✗ Failed to connect to Supabase: {e}")
        return 1

    try:
        country_lookup = fetch_country_lookup(supabase)
    except Exception as e:
        print(f"✗ Failed to fetch countries: {e}")
        return 1

    rows, stats, unmatched_iso2 = map_cities_to_country_ids(cities, country_lookup)

    print("Preparation summary:")
    print(f"  Cities in JSON: {stats['cities_input']}")
    print(f"  Cities mapped to country_id: {stats['cities_mapped']}")
    print(f"  Cities skipped (unmatched country): {stats['cities_unmatched_country']}")
    print(f"  Cities skipped (invalid): {stats['cities_invalid']}")

    if unmatched_iso2:
        preview = ", ".join(unmatched_iso2[:15])
        print(f"  Unmatched ISO2 sample: {preview}")
        if len(unmatched_iso2) > 15:
            print("  ...")

    print()
    if not upsert_cities(supabase, rows):
        return 1

    print("\n✓ Seeding completed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
