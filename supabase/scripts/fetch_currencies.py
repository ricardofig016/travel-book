#!/usr/bin/env python3
"""
Fetch currencies from REST Countries API and create currencies_seed.json
Uses country codes from countries_seed.json to avoid re-fetching all countries.
"""

import json
import requests
import time
from pathlib import Path

BASE_URL = "https://restcountries.com/v3.1"
RATE_LIMIT_DELAY = 0.1  # seconds


def load_country_codes() -> list[tuple[str, str]]:
    """Load country iso2 codes and names from countries_seed.json"""
    countries_file = Path(__file__).parent.parent / "data" / "countries_seed.json"

    with open(countries_file, "r", encoding="utf-8") as f:
        countries = json.load(f)

    return [(c["iso_code_2"], c["name"]) for c in countries]


def fetch_currencies_for_country(iso_code_2: str) -> dict:
    """Fetch currencies for a specific country by ISO code"""
    try:
        response = requests.get(f"{BASE_URL}/alpha/{iso_code_2}")
        response.raise_for_status()
        data = response.json()

        if isinstance(data, list):
            data = data[0]

        return data.get("currencies", {})
    except Exception as e:
        print(f"  Error fetching {iso_code_2}: {e}")
        return {}


def main():
    print("=== Fetching Currencies from REST Countries API ===\n")

    try:
        country_codes = load_country_codes()
        print(f"Loaded {len(country_codes)} country codes from countries_seed.json\n")

        all_currencies = []

        for idx, (iso_code_2, country_name) in enumerate(country_codes, 1):
            print(f"[{idx}/{len(country_codes)}] Fetching currencies for {iso_code_2} ({country_name})...", end=" ")

            currencies_dict = fetch_currencies_for_country(iso_code_2)

            # Convert currencies object to array of records
            for code, currency_info in currencies_dict.items():
                if isinstance(currency_info, dict):
                    all_currencies.append(
                        {
                            "country_iso_code_2": iso_code_2,
                            "code": code.upper(),
                            "symbol": currency_info.get("symbol"),
                            "name": currency_info.get("name"),
                        }
                    )

            print(f"✓ ({len(currencies_dict)} currencies)")
            time.sleep(RATE_LIMIT_DELAY)

        # Save to file
        output_file = Path(__file__).parent.parent / "data" / "currencies_seed.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(all_currencies, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Extracted {len(all_currencies)} total currencies")
        print(f"✓ Saved to {output_file.name}")

        # Show sample
        if all_currencies:
            samples = [c for c in all_currencies if c["country_iso_code_2"] == "PT"]
            if samples:
                print(f"\nSample (Portugal):")
                for s in samples:
                    print(f"  {s}")

        return 0

    except Exception as e:
        print(f"\n✗ Error: {e}")
        return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
