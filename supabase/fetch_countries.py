#!/usr/bin/env python3
"""
Fetch countries data from REST Countries API and save to JSON for database seeding.
Maps API response to travel-book database schema.
"""

import requests
import json
import time
from pathlib import Path
from typing import Optional, Any

BASE_URL = "https://restcountries.com/v3.1"
OUTPUT_FILE = Path(__file__).parent / "countries_seed.json"

# Rate limiting: 60 requests per minute
RATE_LIMIT_DELAY = 0.1  # seconds


def fetch_country_codes() -> list[str]:
    """Fetch list of all country codes."""
    print("Fetching country codes...")
    response = requests.get(f"{BASE_URL}/all", params={"fields": "cca2"})
    response.raise_for_status()
    data = response.json()
    codes = [country["cca2"] for country in data]
    print(f"Found {len(codes)} countries")
    return codes


def extract_native_name(country_data: dict) -> Optional[str]:
    """Extract native common name from nativeName object."""
    native_names = country_data.get("name", {}).get("nativeName", {})
    if native_names:
        # Get the first available native name
        first_lang = next(iter(native_names.values()), {})
        return first_lang.get("common")
    return None


def extract_calling_codes(country_data: dict) -> list[str]:
    """Extract calling codes from idd object."""
    idd = country_data.get("idd", {})
    if not idd or not idd.get("root"):
        return []

    root = idd.get("root", "")
    suffixes = idd.get("suffixes", [])

    # Combine root + suffixes (e.g., "+3" + "51" = "+351")
    return [f"{root}{suffix}" for suffix in suffixes]


def extract_languages(country_data: dict) -> list[str]:
    """Extract language names from languages object."""
    languages = country_data.get("languages", {})
    return list(languages.values()) if languages else []


def extract_car_signs(country_data: dict) -> list[str]:
    """Extract car distinguishing signs."""
    car = country_data.get("car", {})
    return car.get("signs", [])


def transform_country(country_data: dict) -> dict:
    """Transform REST Countries API response to database schema."""
    name_obj = country_data.get("name", {})
    latlng = country_data.get("latlng", [None, None])

    return {
        "name": name_obj.get("common", ""),
        "native_name": extract_native_name(country_data),
        "iso_code_2": country_data.get("cca2", "").upper(),
        "iso_code_3": country_data.get("cca3", "").upper(),
        "area": country_data.get("area"),
        "population": country_data.get("population"),
        "latitude": latlng[0] if latlng[0] is not None else None,
        "longitude": latlng[1] if latlng[1] is not None else None,
        "landlocked": country_data.get("landlocked", False),
        "borders": country_data.get("borders", []),
        "continents": country_data.get("continents", []),
        "subregion": country_data.get("subregion"),
        "calling_codes": extract_calling_codes(country_data),
        "languages": extract_languages(country_data),
        "timezones": country_data.get("timezones", []),
        "car_signs": extract_car_signs(country_data),
        "car_side": country_data.get("car", {}).get("side"),
        "google_maps_url": country_data.get("maps", {}).get("googleMaps"),
        "geometry": country_data.get("geometry"),
        "coat_of_arms_svg": country_data.get("coatOfArms", {}).get("svg"),
        "coat_of_arms_png": country_data.get("coatOfArms", {}).get("png"),
        "flag_emoji": country_data.get("flag"),
        "flag_svg": country_data.get("flags", {}).get("svg"),
        "flag_png": country_data.get("flags", {}).get("png"),
        "flag_alt": country_data.get("flags", {}).get("alt"),
    }


def fetch_and_transform_countries() -> list[dict]:
    """Fetch all countries and transform to database schema."""
    codes = fetch_country_codes()
    countries = []

    print(f"\nFetching detailed data for {len(codes)} countries...")
    for idx, code in enumerate(codes, 1):
        try:
            print(f"[{idx}/{len(codes)}] Fetching {code}...", end=" ")
            response = requests.get(f"{BASE_URL}/alpha/{code}")
            response.raise_for_status()
            country_data = response.json()

            if isinstance(country_data, list):
                country_data = country_data[0]

            transformed = transform_country(country_data)
            countries.append(transformed)
            print("✓")

            # Rate limiting
            time.sleep(RATE_LIMIT_DELAY)

        except requests.exceptions.RequestException as e:
            print(f"✗ Error: {e}")
            continue

    return countries


def main():
    print("=== Travel Book Countries Seeder ===\n")

    try:
        countries = fetch_and_transform_countries()

        # Sort by name for readability
        countries.sort(key=lambda c: c.get("name", ""))

        # Save to JSON
        print(f"\nSaving {len(countries)} countries to {OUTPUT_FILE.name}...")
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(countries, f, indent=2, ensure_ascii=False)

        print(f"✓ Successfully saved to {OUTPUT_FILE}")
        print(f"\nSummary:")
        print(f"  Total countries: {len(countries)}")
        print(f"  Sample: {countries[0]['name']}")

    except Exception as e:
        print(f"✗ Fatal error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
