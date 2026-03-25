#!/usr/bin/env python3
"""
Normalize and clean the country-shape GeoJSON against the countries table.

What this script does:
1) Loads features from visvalingam-weighted_1.8pct_keepshapes_clean.geojson.
2) Loads countries from Supabase.
3) Resolves each feature with this priority (same as seed_country_shapes.py):
   - ISO 3166-1 alpha-3
   - ISO 3166-1 alpha-2
   - Country name (case-insensitive, accent-insensitive canonical form)
4) Removes unmatched features (for example, disputed/non-DB areas).
5) Normalizes matched feature properties to DB values (name, iso2, iso3).
6) Writes a cleaned GeoJSON output file.

Usage:
  python normalize_country_shapes_geojson.py
  python normalize_country_shapes_geojson.py --in-place
  python normalize_country_shapes_geojson.py --output ../data/geo/cleaned.geojson
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

ENV_PATH = Path(__file__).parent.parent.parent / ".env"
DEFAULT_INPUT_FILE = Path(__file__).parent.parent / "data" / "visvalingam-weighted_1.8pct_keepshapes_clean.geojson"
DEFAULT_OUTPUT_FILE = Path(__file__).parent.parent / "data" / "visvalingam-weighted_1.8pct_keepshapes_clean.db-normalized.geojson"

INVALID_ISO_VALUES = {"", "-99", "N/A", "NA", "NULL", "NONE", "--", "-"}

# Deterministic dissolve overrides for known special cases.
FORCED_DISSOLVE_PARENT_BY_FEATURE_NAME = {
    "somaliland": "somalia",
}
NEVER_DISSOLVE_FEATURE_NAMES = {
    "brazilian island",
}

load_dotenv(ENV_PATH)


@dataclass(frozen=True)
class CountryRow:
    """Minimal country identity fields needed for matching and normalization."""

    country_id: str
    name: str
    iso2: str
    iso3: str


@dataclass
class MatchedFeature:
    """Matched feature linked to a DB country row."""

    feature: dict[str, Any]
    country: CountryRow


@dataclass
class UnmatchedFeature:
    """Feature removed from final output, optionally dissolvable into a parent country."""

    name: str
    iso2: str
    iso3: str
    feature: dict[str, Any]


def canonicalize(text: str) -> str:
    """Normalize text for accent-insensitive, case-insensitive matching."""
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return " ".join(ascii_text.lower().strip().split())


def normalize_iso(raw: Any) -> str:
    """Normalize ISO code values and treat placeholders as empty."""
    iso = str(raw or "").strip().upper()
    if iso in INVALID_ISO_VALUES:
        return ""
    return iso


def load_geojson(input_file: Path) -> dict[str, Any] | None:
    """Load and validate GeoJSON payload."""
    if not input_file.exists():
        print(f"ERROR: GeoJSON file not found: {input_file}")
        return None

    with open(input_file, "r", encoding="utf-8") as f:
        payload = json.load(f)

    if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
        print("ERROR: Invalid GeoJSON: expected a FeatureCollection")
        return None

    features = payload.get("features")
    if not isinstance(features, list):
        print("ERROR: Invalid GeoJSON: expected 'features' array")
        return None

    return payload


def fetch_country_lookup(supabase_client: Client) -> tuple[dict[str, CountryRow], dict[str, CountryRow], dict[str, CountryRow], dict[str, CountryRow]]:
    """Build ISO3/ISO2/name lookup maps and id->row map from countries table."""
    response = supabase_client.table("countries").select("id, name, iso_code_2, iso_code_3").execute()
    countries = response.data or []

    iso3_lookup: dict[str, CountryRow] = {}
    iso2_lookup: dict[str, CountryRow] = {}
    name_lookup: dict[str, CountryRow] = {}
    id_lookup: dict[str, CountryRow] = {}

    for row in countries:
        country_id = str(row.get("id") or "").strip()
        name = str(row.get("name") or "").strip()
        iso2 = normalize_iso(row.get("iso_code_2"))
        iso3 = normalize_iso(row.get("iso_code_3"))

        if not country_id or not name:
            continue

        country = CountryRow(country_id=country_id, name=name, iso2=iso2, iso3=iso3)
        id_lookup[country_id] = country

        if iso3:
            iso3_lookup[iso3] = country
        if iso2:
            iso2_lookup[iso2] = country

        # Keep same baseline behavior (name matching), but canonicalize to avoid accent mismatches.
        name_lookup[canonicalize(name)] = country

    return iso3_lookup, iso2_lookup, name_lookup, id_lookup


def resolve_country_row(
    feature: dict[str, Any],
    iso3_lookup: dict[str, CountryRow],
    iso2_lookup: dict[str, CountryRow],
    name_lookup: dict[str, CountryRow],
) -> tuple[CountryRow | None, str]:
    """Resolve a feature to a DB country row by ISO3 -> ISO2 -> name."""
    props = feature.get("properties") or {}

    iso3 = normalize_iso(props.get("ISO3166-1-Alpha-3"))
    iso2 = normalize_iso(props.get("ISO3166-1-Alpha-2"))
    name = str(props.get("name") or "").strip()
    canonical_name = canonicalize(name)

    if iso3 and iso3 in iso3_lookup:
        return iso3_lookup[iso3], "iso3"

    if iso2 and iso2 in iso2_lookup:
        return iso2_lookup[iso2], "iso2"

    if canonical_name and canonical_name in name_lookup:
        return name_lookup[canonical_name], "name"

    return None, "none"


def process_features(
    features: list[dict[str, Any]],
    iso3_lookup: dict[str, CountryRow],
    iso2_lookup: dict[str, CountryRow],
    name_lookup: dict[str, CountryRow],
) -> tuple[list[MatchedFeature], list[UnmatchedFeature], dict[str, int], list[str], list[str], set[str]]:
    """Filter and normalize GeoJSON features using countries from DB."""
    cleaned_features: list[MatchedFeature] = []
    unmatched_features: list[UnmatchedFeature] = []

    stats = {
        "features_total": len(features),
        "features_with_geometry": 0,
        "features_without_geometry": 0,
        "matched_iso3": 0,
        "matched_iso2": 0,
        "matched_name": 0,
        "kept": 0,
        "updated": 0,
        "removed_unmatched": 0,
        "removed_no_geometry": 0,
        "dissolved_into_parent": 0,
        "not_dissolved": 0,
    }

    removed_descriptors: list[str] = []
    updated_descriptors: list[str] = []
    matched_country_ids: set[str] = set()

    for index, feature in enumerate(features, start=1):
        props = feature.get("properties") or {}
        name = str(props.get("name") or "").strip() or "<unknown>"
        old_iso2 = normalize_iso(props.get("ISO3166-1-Alpha-2"))
        old_iso3 = normalize_iso(props.get("ISO3166-1-Alpha-3"))

        print(f"[{index:03d}] Found feature: name='{name}', iso2='{old_iso2 or '-'}', iso3='{old_iso3 or '-'}'")

        if not feature.get("geometry"):
            stats["features_without_geometry"] += 1
            stats["removed_no_geometry"] += 1
            reason = f"name={name}, iso2={old_iso2 or '-'}, iso3={old_iso3 or '-'} (no geometry)"
            removed_descriptors.append(reason)
            print(f"      -> REMOVED (no geometry)")
            continue

        stats["features_with_geometry"] += 1

        country, match_kind = resolve_country_row(feature, iso3_lookup, iso2_lookup, name_lookup)
        if country is None:
            stats["removed_unmatched"] += 1
            reason = f"name={name}, iso2={old_iso2 or '-'}, iso3={old_iso3 or '-'}"
            removed_descriptors.append(reason)
            unmatched_features.append(
                UnmatchedFeature(
                    name=name,
                    iso2=old_iso2,
                    iso3=old_iso3,
                    feature=feature,
                )
            )
            print("      -> REMOVED (not present in DB)")
            continue

        if match_kind == "iso3":
            stats["matched_iso3"] += 1
        elif match_kind == "iso2":
            stats["matched_iso2"] += 1
        elif match_kind == "name":
            stats["matched_name"] += 1

        matched_country_ids.add(country.country_id)

        new_props = dict(props)
        new_props["name"] = country.name
        new_props["ISO3166-1-Alpha-2"] = country.iso2
        new_props["ISO3166-1-Alpha-3"] = country.iso3

        changed_fields: list[str] = []
        if props.get("name") != country.name:
            changed_fields.append(f"name: '{props.get('name')}' -> '{country.name}'")
        if str(props.get("ISO3166-1-Alpha-2") or "") != country.iso2:
            changed_fields.append(f"iso2: '{props.get('ISO3166-1-Alpha-2')}' -> '{country.iso2}'")
        if str(props.get("ISO3166-1-Alpha-3") or "") != country.iso3:
            changed_fields.append(f"iso3: '{props.get('ISO3166-1-Alpha-3')}' -> '{country.iso3}'")

        cleaned_feature = dict(feature)
        cleaned_feature["properties"] = new_props
        cleaned_features.append(MatchedFeature(feature=cleaned_feature, country=country))

        stats["kept"] += 1
        if changed_fields:
            stats["updated"] += 1
            details = "; ".join(changed_fields)
            updated_descriptors.append(f"{country.name}: {details}")
            print(f"      -> KEPT + UPDATED via {match_kind} ({details})")
        else:
            print(f"      -> KEPT (matched via {match_kind}, no property changes)")

    return cleaned_features, unmatched_features, stats, removed_descriptors, updated_descriptors, matched_country_ids


def dissolve_unmatched_into_parents(
    matched_features: list[MatchedFeature],
    unmatched_features: list[UnmatchedFeature],
) -> tuple[list[dict[str, Any]], int, int, list[str]]:
    """Merge removed feature geometries into the best matched parent country geometry."""
    if not unmatched_features:
        return [item.feature for item in matched_features], 0, 0, []

    try:
        from shapely.geometry import shape, mapping
        from shapely.ops import unary_union
    except ImportError:
        print("WARN: Shapely is not installed; skipping dissolve step.")
        print("      Install with: pip install shapely")
        return [item.feature for item in matched_features], 0, len(unmatched_features), []

    # Group kept geometries by country_id so merges update the unified parent geometry.
    grouped_by_country: dict[str, list[Any]] = {}
    template_feature_by_country: dict[str, dict[str, Any]] = {}

    for item in matched_features:
        geometry = item.feature.get("geometry")
        if not geometry:
            continue

        try:
            geom = shape(geometry)
        except Exception:
            continue

        if geom.is_empty:
            continue

        grouped_by_country.setdefault(item.country.country_id, []).append(geom)
        template_feature_by_country.setdefault(item.country.country_id, item.feature)

    country_union: dict[str, Any] = {}
    country_id_by_name: dict[str, str] = {}
    for country_id, geoms in grouped_by_country.items():
        try:
            country_union[country_id] = unary_union(geoms)
        except Exception:
            if geoms:
                country_union[country_id] = geoms[0]

        template = template_feature_by_country.get(country_id, {})
        country_name = str(template.get("properties", {}).get("name") or "").strip()
        if country_name:
            country_id_by_name[canonicalize(country_name)] = country_id

    dissolved = 0
    not_dissolved = 0
    dissolve_logs: list[str] = []

    for removed in unmatched_features:
        geometry = removed.feature.get("geometry")
        if not geometry:
            not_dissolved += 1
            continue

        removed_name_key = canonicalize(removed.name)
        if removed_name_key in NEVER_DISSOLVE_FEATURE_NAMES:
            not_dissolved += 1
            dissolve_logs.append(f"not dissolved: {removed.name} (override: never dissolve)")
            continue

        try:
            removed_geom = shape(geometry)
        except Exception:
            not_dissolved += 1
            continue

        if removed_geom.is_empty:
            not_dissolved += 1
            continue

        forced_parent_name = FORCED_DISSOLVE_PARENT_BY_FEATURE_NAME.get(removed_name_key)
        if forced_parent_name:
            forced_country_id = country_id_by_name.get(canonicalize(forced_parent_name))
            if forced_country_id and forced_country_id in country_union:
                try:
                    country_union[forced_country_id] = unary_union([country_union[forced_country_id], removed_geom])
                    dissolved += 1
                    parent_name = template_feature_by_country.get(forced_country_id, {}).get("properties", {}).get("name", forced_parent_name)
                    dissolve_logs.append(f"dissolved: {removed.name} -> {parent_name} (override)")
                    continue
                except Exception:
                    not_dissolved += 1
                    dissolve_logs.append(f"not dissolved: {removed.name} (override union failed)")
                    continue

            not_dissolved += 1
            dissolve_logs.append(f"not dissolved: {removed.name} (override parent not found: {forced_parent_name})")
            continue

        best_country_id: str | None = None
        best_score = -1.0
        best_overlap_area = 0.0
        best_distance = float("inf")

        for country_id, parent_geom in country_union.items():
            if parent_geom.is_empty:
                continue

            overlap_area = 0.0
            if parent_geom.intersects(removed_geom):
                try:
                    overlap_area = parent_geom.intersection(removed_geom).area
                except Exception:
                    overlap_area = 0.0

            # Prefer actual overlap. Fallback to nearest parent if needed.
            distance = parent_geom.distance(removed_geom)
            score = overlap_area

            if score > best_score or (score == best_score and overlap_area == best_overlap_area and distance < best_distance):
                best_score = score
                best_overlap_area = overlap_area
                best_distance = distance
                best_country_id = country_id

        # If we found no parent, or parent is too far and has no overlap, skip.
        if best_country_id is None:
            not_dissolved += 1
            dissolve_logs.append(f"not dissolved: {removed.name} (iso2={removed.iso2 or '-'}, iso3={removed.iso3 or '-'})")
            continue

        # Accept nearest fallback if very close (shared boundary / tiny numeric gaps).
        if best_overlap_area <= 0 and best_distance > 0.2:
            not_dissolved += 1
            dissolve_logs.append(f"not dissolved: {removed.name} (no overlap, nearest distance={best_distance:.4f})")
            continue

        try:
            country_union[best_country_id] = unary_union([country_union[best_country_id], removed_geom])
            dissolved += 1
            parent_name = template_feature_by_country.get(best_country_id, {}).get("properties", {}).get("name", "<unknown>")
            dissolve_logs.append(f"dissolved: {removed.name} -> {parent_name} " f"(overlap_area={best_overlap_area:.6f}, distance={best_distance:.6f})")
        except Exception:
            not_dissolved += 1
            dissolve_logs.append(f"not dissolved: {removed.name} (union failed)")

    # Rebuild features using the updated per-country unified geometries.
    rebuilt_features: list[dict[str, Any]] = []
    for country_id, parent_geom in country_union.items():
        template = template_feature_by_country.get(country_id)
        if template is None:
            continue

        rebuilt = dict(template)
        rebuilt["geometry"] = mapping(parent_geom)
        rebuilt_features.append(rebuilt)

    return rebuilt_features, dissolved, not_dissolved, dissolve_logs


def write_geojson(payload: dict[str, Any], output_file: Path) -> None:
    """Write GeoJSON payload to disk."""
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    fsize_kb = output_file.stat().st_size / 1024
    print(f"\nOK: Wrote cleaned GeoJSON: {output_file} ({fsize_kb:.1f} KiB)")


def parse_args() -> argparse.Namespace:
    """Parse command-line options."""
    parser = argparse.ArgumentParser(description="Clean/normalize country shapes GeoJSON against countries table.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT_FILE, help=f"Input GeoJSON file (default: {DEFAULT_INPUT_FILE})")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_FILE, help=f"Output GeoJSON file (default: {DEFAULT_OUTPUT_FILE})")
    parser.add_argument("--in-place", action="store_true", help="Overwrite input file in-place (ignores --output)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    output_file = args.input if args.in_place else args.output
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SECRET_KEY")

    if not supabase_url or not supabase_key:
        print("ERROR: Missing environment variables in .env:")
        print("  SUPABASE_URL and SUPABASE_SECRET_KEY")
        print(f"\nLooking for .env at: {ENV_PATH}")
        return 1

    print("=== Travel Book GeoJSON Country Normalizer ===")
    print(f"Input file : {args.input}")
    print(f"Output file: {output_file}\n")

    payload = load_geojson(args.input)
    if payload is None:
        return 1

    features = payload.get("features") or []

    try:
        supabase = create_client(supabase_url, supabase_key)
        print("OK: Connected to Supabase")
    except Exception as e:
        print(f"ERROR: Failed to connect to Supabase: {e}")
        return 1

    try:
        iso3_lookup, iso2_lookup, name_lookup, id_lookup = fetch_country_lookup(supabase)
    except Exception as e:
        print(f"ERROR: Failed to load countries lookup: {e}")
        return 1

    print("OK: Loaded countries lookup " f"(iso3={len(iso3_lookup)}, iso2={len(iso2_lookup)}, name={len(name_lookup)}, total={len(id_lookup)})\n")

    (
        matched_features,
        unmatched_features,
        stats,
        removed_rows,
        updated_rows,
        matched_country_ids,
    ) = process_features(features, iso3_lookup, iso2_lookup, name_lookup)

    (
        cleaned_features,
        dissolved_count,
        not_dissolved_count,
        dissolve_logs,
    ) = dissolve_unmatched_into_parents(matched_features, unmatched_features)

    stats["dissolved_into_parent"] = dissolved_count
    stats["not_dissolved"] = not_dissolved_count

    db_missing_shape = sorted([row.name for row in id_lookup.values() if row.country_id not in matched_country_ids])

    cleaned_payload = dict(payload)
    cleaned_payload["features"] = cleaned_features

    write_geojson(cleaned_payload, output_file)

    print("\nSummary:")
    print(f"  Features in file: {stats['features_total']}")
    print(f"  Features with geometry: {stats['features_with_geometry']}")
    print(f"  Features without geometry: {stats['features_without_geometry']}")
    print(f"  Matched by ISO3: {stats['matched_iso3']}")
    print(f"  Matched by ISO2: {stats['matched_iso2']}")
    print(f"  Matched by name: {stats['matched_name']}")
    print(f"  Kept features: {stats['kept']}")
    print(f"  Updated features: {stats['updated']}")
    print(f"  Removed unmatched features: {stats['removed_unmatched']}")
    print(f"  Removed no-geometry features: {stats['removed_no_geometry']}")
    print(f"  Removed features dissolved into parent: {stats['dissolved_into_parent']}")
    print(f"  Removed features not dissolved: {stats['not_dissolved']}")
    print(f"  Countries in DB without any matched feature: {len(db_missing_shape)}")

    if updated_rows:
        print("\nUpdated features (sample):")
        for row in updated_rows[:25]:
            print(f"  - {row}")
        if len(updated_rows) > 25:
            print(f"  ... ({len(updated_rows) - 25} more)")

    if removed_rows:
        print("\nRemoved features (sample):")
        for row in removed_rows[:25]:
            print(f"  - {row}")
        if len(removed_rows) > 25:
            print(f"  ... ({len(removed_rows) - 25} more)")

    if dissolve_logs:
        print("\nDissolve logs (sample):")
        for row in dissolve_logs[:25]:
            print(f"  - {row}")
        if len(dissolve_logs) > 25:
            print(f"  ... ({len(dissolve_logs) - 25} more)")

    if db_missing_shape:
        print("\nDB countries without a shape match (sample):")
        for name in db_missing_shape[:25]:
            print(f"  - {name}")
        if len(db_missing_shape) > 25:
            print(f"  ... ({len(db_missing_shape) - 25} more)")

    print("\nOK: GeoJSON normalization completed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
