#!/usr/bin/env python3
"""
Seed dishes from dishes_seed.json into Supabase.
Loads SUPABASE_URL and SUPABASE_KEY from .env file.
"""

import json
import os
import sys
import unicodedata
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# Load .env file from project root
ENV_PATH = Path(__file__).parent.parent.parent / ".env"
load_dotenv(ENV_PATH)

COUNTRY_ALIASES = {
    "usa": "United States",
    "united states of america": "United States",
    "uk": "United Kingdom",
    "england": "United Kingdom",
    "democratic republic of the congo": "DR Congo",
    "federated states of micronesia": "Micronesia",
    "north korea": "Korea (Democratic People's Republic of)",
    "south korea": "Korea (Republic of)",
    "czech republic": "Czechia",
    "turkiye": "Turkey",
    "ivory coast": "Cote d'Ivoire",
    "the bahamas": "Bahamas",
    "the gambia": "Gambia",
    "east timor": "Timor-Leste",
    "cape verde": "Cabo Verde",
    "bih": "Bosnia and Herzegovina",
    "vatican city": "Holy See",
}


def canonicalize(text: str) -> str:
    """Normalize text for case- and accent-insensitive matching."""
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return " ".join(ascii_text.lower().strip().split())


def load_dishes_data() -> dict[str, dict]:
    """Load dishes from JSON file."""
    json_file = Path(__file__).parent.parent / "data" / "dishes_seed.json"
    if not json_file.exists():
        print(f"✗ File not found: {json_file}")
        return {}

    with open(json_file, "r", encoding="utf-8") as f:
        return json.load(f)


def fetch_country_lookup(supabase_client) -> dict[str, str]:
    """Fetch all countries and build canonical_name -> country_id lookup."""
    response = supabase_client.table("countries").select("id, name").execute()
    countries = response.data or []

    lookup: dict[str, str] = {}
    for country in countries:
        country_name = country.get("name")
        country_id = country.get("id")
        if not country_name or not country_id:
            continue
        lookup[canonicalize(country_name)] = country_id

    return lookup


def resolve_country_id(country_name: str, country_lookup: dict[str, str]) -> str | None:
    """Resolve a country name from dishes seed data to countries.id."""
    key = canonicalize(country_name)

    if key in country_lookup:
        return country_lookup[key]

    alias_target = COUNTRY_ALIASES.get(key)
    if alias_target:
        alias_key = canonicalize(alias_target)
        return country_lookup.get(alias_key)

    return None


def parse_rating(value) -> float | None:
    """Coerce rating to float when possible."""
    if value is None:
        return None

    try:
        return round(float(value), 1)
    except (TypeError, ValueError):
        return None


def flatten_dishes(seed_data: dict[str, dict], country_lookup: dict[str, str]) -> tuple[list[dict], dict[str, int], list[str]]:
    """Flatten nested country -> food data into dishes table rows."""
    rows: list[dict] = []
    stats = {
        "countries_total": 0,
        "countries_unmatched": 0,
        "dishes_total": 0,
        "dishes_unmatched_country": 0,
        "dishes_invalid": 0,
        "dishes_deduplicated": 0,
    }
    unmatched_countries: list[str] = []

    seen_keys: set[tuple[str, str]] = set()

    for country_payload in seed_data.values():
        stats["countries_total"] += 1

        country_name = str(country_payload.get("name", "")).strip()
        foods = country_payload.get("food", [])

        if not country_name:
            stats["countries_unmatched"] += 1
            stats["dishes_unmatched_country"] += len(foods)
            continue

        country_id = resolve_country_id(country_name, country_lookup)
        if not country_id:
            stats["countries_unmatched"] += 1
            stats["dishes_unmatched_country"] += len(foods)
            unmatched_countries.append(country_name)
            continue

        for dish in foods:
            stats["dishes_total"] += 1

            dish_name = str(dish.get("name", "")).strip()
            if not dish_name:
                stats["dishes_invalid"] += 1
                continue

            dedupe_key = (country_id, canonicalize(dish_name))
            if dedupe_key in seen_keys:
                stats["dishes_deduplicated"] += 1
                continue

            seen_keys.add(dedupe_key)
            rows.append(
                {
                    "country_id": country_id,
                    "name": dish_name,
                    "category": dish.get("category"),
                    "location": dish.get("location"),
                    "tasteatlas_url": dish.get("tasteatlas_url"),
                    "image_url": dish.get("image_url"),
                    "rating": parse_rating(dish.get("rating")),
                }
            )

    return rows, stats, unmatched_countries


def upsert_dishes(supabase_client, dishes: list[dict], batch_size: int = 500) -> bool:
    """Upsert dishes by unique key (name, country_id)."""
    if not dishes:
        print("✗ No dishes to seed")
        return False

    total = len(dishes)
    print(f"Upserting {total} dishes in batches of {batch_size}...")

    try:
        for start in range(0, total, batch_size):
            end = min(start + batch_size, total)
            batch = dishes[start:end]
            supabase_client.table("dishes").upsert(batch, on_conflict="name,country_id").execute()
            print(f"  ✓ Batch {start + 1}-{end} processed")

        print(f"✓ Successfully upserted {total} dishes")
        return True
    except Exception as e:
        print(f"✗ Error upserting dishes: {e}")
        return False


def main() -> int:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print("✗ Missing environment variables in .env:")
        print("  SUPABASE_URL and SUPABASE_KEY")
        print(f"\nLooking for .env at: {ENV_PATH}")
        return 1

    print("=== Travel Book Dishes Seeder ===\n")

    seed_data = load_dishes_data()
    if not seed_data:
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
        print(f"✗ Failed to load countries from Supabase: {e}")
        return 1

    dishes, stats, unmatched_countries = flatten_dishes(seed_data, country_lookup)

    print("Preparation summary:")
    print(f"  Countries in JSON: {stats['countries_total']}")
    print(f"  Countries unmatched: {stats['countries_unmatched']}")
    print(f"  Food entries scanned: {stats['dishes_total']}")
    print(f"  Food entries skipped (unmatched country): {stats['dishes_unmatched_country']}")
    print(f"  Food entries skipped (invalid): {stats['dishes_invalid']}")
    print(f"  Food entries deduplicated: {stats['dishes_deduplicated']}")
    print(f"  Food entries ready for upsert: {len(dishes)}\n")

    if unmatched_countries:
        preview = ", ".join(sorted(set(unmatched_countries))[:10])
        print(f"Unmatched countries (sample): {preview}")
        if len(set(unmatched_countries)) > 10:
            print("  ...")
        print()

    if not upsert_dishes(supabase, dishes):
        return 1

    print("\n✓ Seeding completed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
