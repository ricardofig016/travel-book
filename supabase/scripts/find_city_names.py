#!/usr/bin/env python3
"""Comprehensive city finder with multiple matching strategies."""

import os
import unicodedata
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

env_path = Path(".") / ".env"
load_dotenv(env_path)

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SECRET_KEY"))

# Map of target cities to find
targets = {"Japan": ["Tokyo", "Kyoto", "Osaka"], "Portugal": ["Lisbon", "Porto"], "France": ["Paris", "Lyon"], "Italy": ["Rome", "Venice"], "Brazil": ["Rio de Janeiro", "Salvador", "Sao Paulo"]}


def normalize_ascii(text: str) -> str:
    """Convert text to ASCII, removing accents."""
    normalized = unicodedata.normalize("NFKD", text)
    return normalized.encode("ascii", "ignore").decode("ascii").strip()


for country_name, cities in targets.items():
    # Get country ID
    resp = supabase.table("countries").select("id").eq("name", country_name).execute()
    if not resp.data:
        print(f"✗ Country not found: {country_name}")
        continue

    country_id = resp.data[0]["id"]

    # Load ALL cities for this country (paginate)
    print(f"\n{country_name}:")
    all_cities_data = []
    offset = 0
    batch_size = 1000

    while True:
        resp = supabase.table("cities").select("name, name_ascii").eq("country_id", country_id).range(offset, offset + batch_size - 1).execute()
        batch = resp.data or []
        if not batch:
            break
        all_cities_data.extend(batch)
        offset += batch_size

    all_city_names = [c["name"] for c in all_cities_data]
    all_city_names_ascii = [c["name_ascii"] for c in all_cities_data if c.get("name_ascii")]

    print(f"  Total cities in DB: {len(all_cities_data)}")

    for target_city in cities:
        found = False

        # Try 1: Exact match (case-insensitive)
        matches = [c for c in all_city_names if c.lower() == target_city.lower()]
        if matches:
            print(f"  ✓ {target_city} -> exact match: {matches[0]}")
            found = True
            continue

        # Try 2: Match with ASCII normalization
        target_ascii = normalize_ascii(target_city)
        matches_ascii = [c for c in all_city_names_ascii if c.lower() == target_ascii.lower()]
        if matches_ascii:
            actual_cities = [c["name"] for c in all_cities_data if c.get("name_ascii", "").lower() == target_ascii.lower()]
            print(f"  ✓ {target_city} -> ASCII match: {actual_cities[0]} (stored as: {matches_ascii[0]})")
            found = True
            continue

        # Try 3: Partial/substring match
        contains_matches = [c for c in all_city_names if target_city.lower() in c.lower() or c.lower() in target_city.lower()]
        if contains_matches:
            print(f"  ~ {target_city} -> partial match: {contains_matches[0]}")
            found = True
            continue

        # Try 4: Match first word
        first_word = target_city.split()[0].lower()
        word_matches = [c for c in all_city_names if c.lower().startswith(first_word)]
        if word_matches:
            print(f"  ~ {target_city} -> starts with '{first_word}': {word_matches[0]}")
            found = True
            continue

        if not found:
            print(f"  ✗ {target_city} -> NOT FOUND")
            # Show some similar cities
            print(f"      Sample cities: {all_city_names[:5]}")
