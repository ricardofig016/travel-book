#!/usr/bin/env python3
"""
Seed country shapes from visvalingam-weighted_1.8pct_keepshapes_clean.geojson
into countries.geometry (JSONB) in Supabase.

Matching priority for each feature:
1) ISO 3166-1 alpha-3
2) ISO 3166-1 alpha-2
3) Country name (case-insensitive)
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
DATA_FILE = Path(__file__).parent.parent / "data" / "visvalingam-weighted_1.8pct_keepshapes_clean.geojson"

load_dotenv(ENV_PATH)


def load_geojson_features() -> list[dict[str, Any]]:
    """Load features from GeoJSON file."""
    if not DATA_FILE.exists():
        print(f"✗ File not found: {DATA_FILE}")
        return []

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        payload = json.load(f)

    if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
        print("✗ Invalid GeoJSON: expected a FeatureCollection object")
        return []

    features = payload.get("features")
    if not isinstance(features, list):
        print("✗ Invalid GeoJSON: expected 'features' to be a list")
        return []

    return features


def fetch_country_lookup(supabase_client: Client) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """Build lookup maps for ISO3, ISO2 and name -> country id."""
    response = supabase_client.table("countries").select("id, iso_code_2, iso_code_3, name").execute()
    countries = response.data or []

    iso3_lookup: dict[str, str] = {}
    iso2_lookup: dict[str, str] = {}
    name_lookup: dict[str, str] = {}

    for row in countries:
        country_id = row.get("id")
        if not country_id:
            continue

        iso3 = str(row.get("iso_code_3") or "").strip().upper()
        iso2 = str(row.get("iso_code_2") or "").strip().upper()
        name = str(row.get("name") or "").strip().lower()

        if iso3:
            iso3_lookup[iso3] = country_id
        if iso2:
            iso2_lookup[iso2] = country_id
        if name:
            name_lookup[name] = country_id

    return iso3_lookup, iso2_lookup, name_lookup


def resolve_country_id(
    feature: dict[str, Any],
    iso3_lookup: dict[str, str],
    iso2_lookup: dict[str, str],
    name_lookup: dict[str, str],
) -> tuple[str | None, str]:
    """Resolve the target country id for a GeoJSON feature."""
    props = feature.get("properties") or {}

    iso3 = str(props.get("ISO3166-1-Alpha-3") or "").strip().upper()
    iso2 = str(props.get("ISO3166-1-Alpha-2") or "").strip().upper()
    name = str(props.get("name") or "").strip().lower()

    if iso3 and iso3 in iso3_lookup:
        return iso3_lookup[iso3], "iso3"

    if iso2 and iso2 in iso2_lookup:
        return iso2_lookup[iso2], "iso2"

    if name and name in name_lookup:
        return name_lookup[name], "name"

    return None, "none"


def update_country_shapes(
    supabase_client: Client,
    features: list[dict[str, Any]],
    iso3_lookup: dict[str, str],
    iso2_lookup: dict[str, str],
    name_lookup: dict[str, str],
) -> tuple[bool, dict[str, int], list[str]]:
    """Update countries.geometry from GeoJSON feature geometry."""
    stats = {
        "features_total": len(features),
        "features_with_geometry": 0,
        "features_without_geometry": 0,
        "matched_iso3": 0,
        "matched_iso2": 0,
        "matched_name": 0,
        "unmatched": 0,
        "updated": 0,
        "failed_updates": 0,
    }
    unmatched_preview: list[str] = []

    for feature in features:
        geometry = feature.get("geometry")
        props = feature.get("properties") or {}

        if not geometry:
            stats["features_without_geometry"] += 1
            continue

        stats["features_with_geometry"] += 1
        country_id, match_kind = resolve_country_id(feature, iso3_lookup, iso2_lookup, name_lookup)

        if not country_id:
            stats["unmatched"] += 1
            descriptor = f"name={props.get('name')}, " f"iso2={props.get('ISO3166-1-Alpha-2')}, " f"iso3={props.get('ISO3166-1-Alpha-3')}"
            if len(unmatched_preview) < 20:
                unmatched_preview.append(descriptor)
            continue

        if match_kind == "iso3":
            stats["matched_iso3"] += 1
        elif match_kind == "iso2":
            stats["matched_iso2"] += 1
        elif match_kind == "name":
            stats["matched_name"] += 1

        try:
            supabase_client.table("countries").update({"geometry": geometry}).eq("id", country_id).execute()
            stats["updated"] += 1
        except Exception:
            stats["failed_updates"] += 1

    success = stats["failed_updates"] == 0
    return success, stats, unmatched_preview


def main() -> int:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SECRET_KEY")

    if not supabase_url or not supabase_key:
        print("✗ Missing environment variables in .env:")
        print("  SUPABASE_URL and SUPABASE_SECRET_KEY")
        print(f"\nLooking for .env at: {ENV_PATH}")
        return 1

    print("=== Travel Book Country Shapes Seeder ===\n")

    features = load_geojson_features()
    if not features:
        return 1

    try:
        supabase = create_client(supabase_url, supabase_key)
        print("✓ Connected to Supabase\n")
    except Exception as e:
        print(f"✗ Failed to connect to Supabase: {e}")
        return 1

    try:
        iso3_lookup, iso2_lookup, name_lookup = fetch_country_lookup(supabase)
    except Exception as e:
        print(f"✗ Failed to load countries: {e}")
        return 1

    ok, stats, unmatched_preview = update_country_shapes(supabase, features, iso3_lookup, iso2_lookup, name_lookup)

    print("Seeding summary:")
    print(f"  Features in file: {stats['features_total']}")
    print(f"  Features with geometry: {stats['features_with_geometry']}")
    print(f"  Features without geometry: {stats['features_without_geometry']}")
    print(f"  Matched by ISO3: {stats['matched_iso3']}")
    print(f"  Matched by ISO2: {stats['matched_iso2']}")
    print(f"  Matched by name: {stats['matched_name']}")
    print(f"  Unmatched features: {stats['unmatched']}")
    print(f"  Rows updated: {stats['updated']}")
    print(f"  Failed updates: {stats['failed_updates']}")

    if unmatched_preview:
        print("\nUnmatched feature sample:")
        for row in unmatched_preview[:10]:
            print(f"  - {row}")

    if not ok:
        print("\n✗ Seeding finished with errors")
        return 1

    print("\n✓ Country shape seeding completed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
