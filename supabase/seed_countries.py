#!/usr/bin/env python3
"""
Seed countries data from countries_seed.json into Supabase.
Loads SUPABASE_URL and SUPABASE_KEY from .env file.
"""

import json
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client


def load_countries() -> list[dict]:
    """Load countries from JSON file."""
    json_file = Path(__file__).parent / "countries_seed.json"
    if not json_file.exists():
        print(f"✗ File not found: {json_file}")
        print("  Run fetch_countries.py first")
        return []

    with open(json_file, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_countries(supabase_client, countries: list[dict]) -> bool:
    """Insert countries into database."""
    if not countries:
        print("✗ No countries to seed")
        return False

    print(f"Seeding {len(countries)} countries...")

    try:
        # Batch insert all countries
        response = supabase_client.table("countries").insert(countries).execute()
        print(f"✓ Successfully inserted {len(countries)} countries")
        return True

    except Exception as e:
        print(f"✗ Error inserting countries: {e}")
        return False


def main():
    # Load .env file from parent directory (project root)
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(env_path)

    # Get Supabase credentials from environment
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print("✗ Missing environment variables in .env:")
        print("  SUPABASE_URL and SUPABASE_KEY")
        print(f"\nLooking for .env at: {env_path}")
        return 1

    print("=== Travel Book Countries Seeder ===\n")

    # Load countries from JSON
    countries = load_countries()
    if not countries:
        return 1

    # Initialize Supabase client
    try:
        supabase = create_client(supabase_url, supabase_key)
        print("✓ Connected to Supabase\n")
    except Exception as e:
        print(f"✗ Failed to connect to Supabase: {e}")
        return 1

    # Seed countries
    if not seed_countries(supabase, countries):
        return 1

    print("\n✓ Seeding completed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
