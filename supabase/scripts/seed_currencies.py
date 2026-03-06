#!/usr/bin/env python3
"""
Seed currencies from currencies_seed.json into Supabase.
Loads SUPABASE_URL and SUPABASE_KEY from .env file.
"""

import json
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# Load .env file from project root
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)


def load_currencies() -> list[dict]:
    """Load currencies from JSON file."""
    json_file = Path(__file__).parent.parent / "data" / "currencies_seed.json"
    if not json_file.exists():
        print(f"✗ File not found: {json_file}")
        print("  Run fetch_currencies.py first")
        return []

    with open(json_file, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_currencies(supabase_client, currencies: list[dict]) -> bool:
    """Insert currencies into database with country ID lookup."""
    if not currencies:
        print("✗ No currencies to seed")
        return False

    print(f"Processing {len(currencies)} currencies...")

    # Group by country code for batch lookup
    country_codes = list(set(c["country_iso_code_2"] for c in currencies))
    print(f"Looking up {len(country_codes)} countries...")

    try:
        # Fetch all countries to get their IDs
        countries_response = supabase_client.table("countries").select("id, iso_code_2").execute()

        # Create mapping of iso_code_2 -> id
        country_map = {c["iso_code_2"]: c["id"] for c in countries_response.data}

        # Transform currencies to include country_id
        currencies_with_ids = []
        skipped = 0

        for currency in currencies:
            iso_code = currency["country_iso_code_2"]
            country_id = country_map.get(iso_code)

            if not country_id:
                print(f"  ⚠ Country {iso_code} not found, skipping")
                skipped += 1
                continue

            currencies_with_ids.append(
                {
                    "country_id": country_id,
                    "code": currency["code"],
                    "symbol": currency.get("symbol"),
                    "name": currency.get("name"),
                }
            )

        if skipped > 0:
            print(f"  Skipped {skipped} currencies (country not found)")

        # Batch insert
        print(f"\nInserting {len(currencies_with_ids)} currencies...")
        response = supabase_client.table("currencies").insert(currencies_with_ids).execute()

        print(f"✓ Successfully inserted {len(currencies_with_ids)} currencies")
        return True

    except Exception as e:
        print(f"✗ Error seeding currencies: {e}")
        return False


def main():
    # Get Supabase credentials from environment
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SECRET_KEY")

    if not supabase_url or not supabase_key:
        print("✗ Missing environment variables in .env:")
        print("  SUPABASE_URL and SUPABASE_SECRET_KEY")
        print(f"\nLooking for .env at: {env_path}")
        return 1

    print("=== Travel Book Currencies Seeder ===\n")

    # Load currencies from JSON
    currencies = load_currencies()
    if not currencies:
        return 1

    # Initialize Supabase client
    try:
        supabase = create_client(supabase_url, supabase_key)
        print("✓ Connected to Supabase\n")
    except Exception as e:
        print(f"✗ Failed to connect to Supabase: {e}")
        return 1

    # Seed currencies
    if not seed_currencies(supabase, currencies):
        return 1

    print("\n✓ Seeding completed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
