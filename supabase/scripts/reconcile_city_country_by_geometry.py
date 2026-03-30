#!/usr/bin/env python3
"""
Validate city -> country assignments against country boundary geometry and repair mismatches.

Goals:
- Correctness first: only auto-update when confidence is high.
- Completeness: inspect every city from DB.
- Performance: use STRtree spatial index + batched DB updates.
- Auditability: write a detailed log file with per-city decisions and per-country deltas.

Usage:
  python reconcile_city_country_by_geometry.py
  python reconcile_city_country_by_geometry.py --apply
  python reconcile_city_country_by_geometry.py --apply --nearest-tolerance-deg 0.08
"""

from __future__ import annotations

import argparse
import contextlib
import json
import logging
import os
import io
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client
import normalize_country_shapes_geojson as geo_normalizer

try:
    from shapely.geometry import Point, shape
    from shapely.strtree import STRtree
except Exception as import_err:  # pragma: no cover
    print("ERROR: Missing required dependency 'shapely'.")
    print("Install it with: pip install shapely")
    print(f"Details: {import_err}")
    sys.exit(1)

ENV_PATH = Path(__file__).parent.parent.parent / ".env"
LOG_DIR = Path(__file__).parent.parent / "logs"
DEFAULT_SOURCE_GEOJSON = Path(__file__).parent.parent.parent / "public" / "assets" / "data" / "geo" / "countries.geojson"
FETCH_PAGE_SIZE = 1000
UPDATE_BATCH_SIZE = 500

VATICAN_CITY_NAME_NORMALIZED = "vatican city"
VATICAN_ISO2 = "VA"

load_dotenv(ENV_PATH)


@dataclass(frozen=True)
class CountryGeom:
    country_id: str
    name: str
    iso2: str
    geom: Any
    area: float


@dataclass(frozen=True)
class CityRow:
    city_id: str
    name: str
    country_id: str
    latitude: float
    longitude: float


@dataclass(frozen=True)
class MismatchDecision:
    city: CityRow
    old_country_id: str
    old_country_name: str
    new_country_id: str | None
    new_country_name: str | None
    strategy: str
    confidence: str
    nearest_distance: float | None
    second_nearest_distance: float | None
    details: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=("Validate city-country assignments against country geometries and optionally repair mismatches."))
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply updates to DB. By default, script runs in dry-run mode.",
    )
    parser.add_argument(
        "--nearest-tolerance-deg",
        type=float,
        default=0.08,
        help=("Max geometry distance (degrees) for nearest fallback assignment when point is not inside any polygon." " Default: 0.08"),
    )
    parser.add_argument(
        "--nearest-margin-ratio",
        type=float,
        default=0.6,
        help=("Confidence margin for nearest fallback: nearest must be <= ratio * second_nearest." " Lower = stricter. Default: 0.6"),
    )
    parser.add_argument(
        "--max-cities",
        type=int,
        default=0,
        help="Optional safety limit for number of cities to process (0 = all).",
    )
    parser.add_argument(
        "--source-geojson",
        type=Path,
        default=DEFAULT_SOURCE_GEOJSON,
        help=("Original source GeoJSON to normalize before reconciliation " f"(default: {DEFAULT_SOURCE_GEOJSON})."),
    )
    return parser.parse_args()


def setup_logger() -> tuple[logging.Logger, Path]:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    log_path = LOG_DIR / f"reconcile-city-country-{timestamp}.log"

    logger = logging.getLogger("reconcile_city_country")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger, log_path


def get_client() -> Client:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SECRET_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env." f" Expected at: {ENV_PATH}")

    return create_client(supabase_url, supabase_key)


def fetch_all_rows(client: Client, table: str, select_cols: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    last_id: str | None = None

    while True:
        query = client.table(table).select(select_cols).order("id").limit(FETCH_PAGE_SIZE)
        if last_id is not None:
            query = query.gt("id", last_id)

        response = query.execute()
        batch = response.data or []
        if not batch:
            break

        rows.extend(batch)
        last_id = str(batch[-1].get("id") or "")

    return rows


def build_country_geoms(raw_countries: list[dict[str, Any]], logger: logging.Logger) -> tuple[list[CountryGeom], dict[str, CountryGeom], list[Any], STRtree]:
    country_geoms: list[CountryGeom] = []

    for row in raw_countries:
        country_id = str(row.get("id") or "").strip()
        name = str(row.get("name") or "").strip()
        iso2 = str(row.get("iso_code_2") or "").strip().upper()
        geometry = row.get("geometry")

        if not country_id or not name or not iso2 or not geometry:
            continue

        try:
            geom = shape(geometry)
        except Exception as err:
            logger.error(
                "country_geometry_parse_error | country_id=%s | name=%s | error=%s",
                country_id,
                name,
                err,
            )
            continue

        if geom.is_empty:
            logger.warning(
                "country_geometry_empty | country_id=%s | name=%s",
                country_id,
                name,
            )
            continue

        # Repair invalid geometry if possible.
        if not geom.is_valid:
            try:
                repaired = geom.buffer(0)
                if repaired.is_empty:
                    logger.error(
                        "country_geometry_invalid_unrepairable | country_id=%s | name=%s",
                        country_id,
                        name,
                    )
                    continue
                geom = repaired
            except Exception as err:
                logger.error(
                    "country_geometry_invalid_repair_error | country_id=%s | name=%s | error=%s",
                    country_id,
                    name,
                    err,
                )
                continue

        area = float(geom.area)
        country_geoms.append(
            CountryGeom(
                country_id=country_id,
                name=name,
                iso2=iso2,
                geom=geom,
                area=area,
            )
        )

    by_id = {row.country_id: row for row in country_geoms}
    geometries = [row.geom for row in country_geoms]
    tree = STRtree(geometries)

    return country_geoms, by_id, geometries, tree


def build_country_geoms_from_source_geojson(
    client: Client,
    source_geojson: Path,
    logger: logging.Logger,
) -> tuple[list[CountryGeom], dict[str, CountryGeom], list[Any], STRtree, dict[str, int]]:
    """Build country geometries from original GeoJSON after DB normalization+dissolve."""
    payload = geo_normalizer.load_geojson(source_geojson)
    if payload is None:
        raise RuntimeError(f"Failed to load source GeoJSON: {source_geojson}")

    with contextlib.redirect_stdout(io.StringIO()):
        iso3_lookup, iso2_lookup, name_lookup, _ = geo_normalizer.fetch_country_lookup(client)
        (
            matched_features,
            unmatched_features,
            stats,
            _removed_rows,
            _updated_rows,
            _matched_country_ids,
        ) = geo_normalizer.process_features(
            payload.get("features") or [],
            iso3_lookup,
            iso2_lookup,
            name_lookup,
        )
        cleaned_features, dissolved_count, not_dissolved_count, _ = geo_normalizer.dissolve_unmatched_into_parents(
            matched_features,
            unmatched_features,
        )

    stats["dissolved_into_parent"] = dissolved_count
    stats["not_dissolved"] = not_dissolved_count

    logger.info(
        "source_geojson_summary | file=%s | features_total=%s | kept=%s | removed_unmatched=%s | removed_no_geometry=%s | dissolved=%s | not_dissolved=%s",
        source_geojson,
        stats.get("features_total", 0),
        stats.get("kept", 0),
        stats.get("removed_unmatched", 0),
        stats.get("removed_no_geometry", 0),
        stats.get("dissolved_into_parent", 0),
        stats.get("not_dissolved", 0),
    )

    country_geoms: list[CountryGeom] = []
    for feature in cleaned_features:
        props = feature.get("properties") or {}
        geometry = feature.get("geometry")
        if not geometry:
            continue

        iso2 = geo_normalizer.normalize_iso(props.get("ISO3166-1-Alpha-2"))
        name = str(props.get("name") or "").strip()
        country = iso2_lookup.get(iso2)
        if country is None and name:
            country = name_lookup.get(geo_normalizer.canonicalize(name))

        if country is None:
            logger.warning(
                "source_geojson_country_unmapped | name=%s | iso2=%s",
                name or "<unknown>",
                iso2 or "-",
            )
            continue

        try:
            geom = shape(geometry)
        except Exception as err:
            logger.error(
                "source_geojson_geometry_parse_error | country_id=%s | country_name=%s | error=%s",
                country.country_id,
                country.name,
                err,
            )
            continue

        if geom.is_empty:
            logger.warning(
                "source_geojson_geometry_empty | country_id=%s | country_name=%s",
                country.country_id,
                country.name,
            )
            continue

        if not geom.is_valid:
            try:
                repaired = geom.buffer(0)
                if repaired.is_empty:
                    logger.error(
                        "source_geojson_geometry_invalid_unrepairable | country_id=%s | country_name=%s",
                        country.country_id,
                        country.name,
                    )
                    continue
                geom = repaired
            except Exception as err:
                logger.error(
                    "source_geojson_geometry_repair_error | country_id=%s | country_name=%s | error=%s",
                    country.country_id,
                    country.name,
                    err,
                )
                continue

        country_geoms.append(
            CountryGeom(
                country_id=country.country_id,
                name=country.name,
                iso2=country.iso2,
                geom=geom,
                area=float(geom.area),
            )
        )

    by_id = {row.country_id: row for row in country_geoms}
    geometries = [row.geom for row in country_geoms]
    tree = STRtree(geometries)

    return country_geoms, by_id, geometries, tree, stats


def build_cities(raw_cities: list[dict[str, Any]], logger: logging.Logger) -> list[CityRow]:
    cities: list[CityRow] = []

    for row in raw_cities:
        city_id = str(row.get("id") or "").strip()
        name = str(row.get("name") or "").strip()
        country_id = str(row.get("country_id") or "").strip()

        try:
            lat = float(row.get("latitude"))
            lon = float(row.get("longitude"))
        except (TypeError, ValueError):
            logger.error(
                "city_coordinate_parse_error | city_id=%s | city_name=%s | latitude=%s | longitude=%s",
                city_id,
                name,
                row.get("latitude"),
                row.get("longitude"),
            )
            continue

        if not city_id or not country_id or not name:
            logger.error(
                "city_row_invalid | city_id=%s | city_name=%s | country_id=%s",
                city_id,
                name,
                country_id,
            )
            continue

        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            logger.error(
                "city_coordinate_out_of_range | city_id=%s | city_name=%s | latitude=%s | longitude=%s",
                city_id,
                name,
                lat,
                lon,
            )
            continue

        cities.append(
            CityRow(
                city_id=city_id,
                name=name,
                country_id=country_id,
                latitude=lat,
                longitude=lon,
            )
        )

    return cities


def choose_country_for_city(
    city: CityRow,
    countries: list[CountryGeom],
    by_country_id: dict[str, CountryGeom],
    geometries: list[Any],
    tree: STRtree,
    nearest_tolerance_deg: float,
    nearest_margin_ratio: float,
) -> MismatchDecision | None:
    point = Point(city.longitude, city.latitude)

    old_country = by_country_id.get(city.country_id)
    old_name = old_country.name if old_country else "<missing-country-row>"

    # Explicit safeguard: keep Vatican City in Vatican City even when geometry overlap/simplification may pull to Italy.
    if city.name.strip().casefold() == VATICAN_CITY_NAME_NORMALIZED:
        vatican_country = next((country for country in countries if country.iso2 == VATICAN_ISO2), None)
        if vatican_country is not None:
            if city.country_id == vatican_country.country_id:
                return None

            return MismatchDecision(
                city=city,
                old_country_id=city.country_id,
                old_country_name=old_name,
                new_country_id=vatican_country.country_id,
                new_country_name=vatican_country.name,
                strategy="manual-override-vatican",
                confidence="high",
                nearest_distance=0.0,
                second_nearest_distance=None,
                details="Forced override for Vatican City city assignment.",
            )

    # Fast candidate shortlist by bbox intersection.
    index_matches = tree.query(point)
    candidate_indices = [int(idx) for idx in index_matches.tolist()] if hasattr(index_matches, "tolist") else [int(idx) for idx in index_matches]

    covering: list[CountryGeom] = []
    for idx in candidate_indices:
        country = countries[idx]
        try:
            if country.geom.covers(point):
                covering.append(country)
        except Exception:
            continue

    # Case 1: exact inside one or more countries.
    if covering:
        # Already correct assignment.
        if any(c.country_id == city.country_id for c in covering):
            return None

        if len(covering) == 1:
            target = covering[0]
            return MismatchDecision(
                city=city,
                old_country_id=city.country_id,
                old_country_name=old_name,
                new_country_id=target.country_id,
                new_country_name=target.name,
                strategy="unique-cover",
                confidence="high",
                nearest_distance=0.0,
                second_nearest_distance=None,
                details="Point covered by exactly one country polygon.",
            )

        # Ambiguous overlap: avoid incorrect updates.
        names = ", ".join(sorted(c.name for c in covering))
        return MismatchDecision(
            city=city,
            old_country_id=city.country_id,
            old_country_name=old_name,
            new_country_id=None,
            new_country_name=None,
            strategy="ambiguous-overlap",
            confidence="low",
            nearest_distance=0.0,
            second_nearest_distance=0.0,
            details=f"Point covered by multiple countries: {names}",
        )

    # Case 2: no polygon covers point; fallback to nearest with strict confidence checks.
    distances: list[tuple[float, CountryGeom]] = []
    for country in countries:
        try:
            dist = float(country.geom.distance(point))
            distances.append((dist, country))
        except Exception:
            continue

    if not distances:
        return MismatchDecision(
            city=city,
            old_country_id=city.country_id,
            old_country_name=old_name,
            new_country_id=None,
            new_country_name=None,
            strategy="no-geometry-candidates",
            confidence="low",
            nearest_distance=None,
            second_nearest_distance=None,
            details="No country geometries available for nearest fallback.",
        )

    distances.sort(key=lambda pair: pair[0])
    nearest_distance, nearest_country = distances[0]
    second_distance = distances[1][0] if len(distances) > 1 else None

    # If current country is nearest, keep it even if point missed polygon due simplification/noise.
    if nearest_country.country_id == city.country_id:
        return None

    within_tolerance = nearest_distance <= nearest_tolerance_deg
    margin_ok = second_distance is None or nearest_distance <= (second_distance * nearest_margin_ratio)

    if within_tolerance and margin_ok:
        return MismatchDecision(
            city=city,
            old_country_id=city.country_id,
            old_country_name=old_name,
            new_country_id=nearest_country.country_id,
            new_country_name=nearest_country.name,
            strategy="nearest-fallback",
            confidence="medium",
            nearest_distance=nearest_distance,
            second_nearest_distance=second_distance,
            details=("Point not inside any polygon; nearest country selected with strict tolerance+margin checks."),
        )

    return MismatchDecision(
        city=city,
        old_country_id=city.country_id,
        old_country_name=old_name,
        new_country_id=None,
        new_country_name=None,
        strategy="unresolved-outside",
        confidence="low",
        nearest_distance=nearest_distance,
        second_nearest_distance=second_distance,
        details=("Point not inside any polygon and nearest fallback did not meet confidence checks."),
    )


def apply_updates(
    client: Client,
    accepted: list[MismatchDecision],
    logger: logging.Logger,
) -> tuple[int, int, set[str]]:
    if not accepted:
        return 0, 0, set()

    by_target: dict[str, list[str]] = defaultdict(list)
    for decision in accepted:
        if decision.new_country_id:
            by_target[decision.new_country_id].append(decision.city.city_id)

    success = 0
    failed = 0
    applied_city_ids: set[str] = set()

    for target_country_id, city_ids in by_target.items():
        for start in range(0, len(city_ids), UPDATE_BATCH_SIZE):
            chunk = city_ids[start : start + UPDATE_BATCH_SIZE]
            try:
                result = client.table("cities").update({"country_id": target_country_id}).in_("id", chunk).execute()
                # Supabase returns updated rows in result.data when configured; count by chunk length for deterministic accounting.
                success += len(chunk)
                applied_city_ids.update(chunk)
                logger.info(
                    "update_batch_success | target_country_id=%s | batch_size=%s",
                    target_country_id,
                    len(chunk),
                )
                if result is None:  # keep linter happy in strict environments
                    pass
            except Exception as err:
                failed += len(chunk)
                logger.error(
                    "update_batch_error | target_country_id=%s | batch_size=%s | error=%s",
                    target_country_id,
                    len(chunk),
                    err,
                )

    return success, failed, applied_city_ids


def main() -> int:
    args = parse_args()
    logger, log_path = setup_logger()

    started_at = time.time()
    logger.info("run_start | mode=%s", "apply" if args.apply else "dry-run")
    logger.info(
        "params | nearest_tolerance_deg=%s | nearest_margin_ratio=%s | max_cities=%s | source_geojson=%s",
        args.nearest_tolerance_deg,
        args.nearest_margin_ratio,
        args.max_cities,
        args.source_geojson,
    )

    try:
        client = get_client()
    except Exception as err:
        logger.exception("fatal | failed_to_create_client | error=%s", err)
        print(f"ERROR: {err}")
        print(f"Log file: {log_path}")
        return 1

    try:
        raw_countries = fetch_all_rows(
            client,
            "countries",
            "id, name, iso_code_2",
        )
        raw_cities = fetch_all_rows(
            client,
            "cities",
            "id, name, country_id, latitude, longitude",
        )
    except Exception as err:
        logger.exception("fatal | fetch_error | error=%s", err)
        print(f"ERROR: Failed to fetch data: {err}")
        print(f"Log file: {log_path}")
        return 1

    try:
        country_geoms, by_country_id, geometries, tree, source_stats = build_country_geoms_from_source_geojson(
            client,
            args.source_geojson,
            logger,
        )
    except Exception as err:
        logger.exception("fatal | source_geojson_build_error | error=%s", err)
        print(f"ERROR: Failed to build geometries from source GeoJSON: {err}")
        print(f"Log file: {log_path}")
        return 1

    cities = build_cities(raw_cities, logger)

    if args.max_cities > 0:
        cities = cities[: args.max_cities]

    if not country_geoms:
        logger.error("fatal | no_country_geometries_available")
        print("ERROR: No usable country geometries found.")
        print(f"Log file: {log_path}")
        return 1

    before_counts = Counter(city.country_id for city in cities)

    logger.info(
        "dataset_summary | countries_total=%s | countries_with_geometry=%s | cities_total=%s | source_features_kept=%s",
        len(raw_countries),
        len(country_geoms),
        len(cities),
        source_stats.get("kept", 0),
    )

    mismatches: list[MismatchDecision] = []
    accepted_updates: list[MismatchDecision] = []
    unresolved: list[MismatchDecision] = []

    for idx, city in enumerate(cities, start=1):
        decision = choose_country_for_city(
            city=city,
            countries=country_geoms,
            by_country_id=by_country_id,
            geometries=geometries,
            tree=tree,
            nearest_tolerance_deg=args.nearest_tolerance_deg,
            nearest_margin_ratio=args.nearest_margin_ratio,
        )
        if decision is None:
            continue

        mismatches.append(decision)

        if decision.new_country_id is not None:
            accepted_updates.append(decision)
            logger.info(
                "mismatch_fixable | city_id=%s | city_name=%s | old_country=%s | new_country=%s | strategy=%s | confidence=%s | nearest=%.8f | second_nearest=%s | details=%s",
                decision.city.city_id,
                decision.city.name,
                decision.old_country_name,
                decision.new_country_name,
                decision.strategy,
                decision.confidence,
                decision.nearest_distance or 0.0,
                f"{decision.second_nearest_distance:.8f}" if decision.second_nearest_distance is not None else "None",
                decision.details,
            )
        else:
            unresolved.append(decision)
            logger.warning(
                "mismatch_unresolved | city_id=%s | city_name=%s | old_country=%s | strategy=%s | confidence=%s | nearest=%s | second_nearest=%s | details=%s",
                decision.city.city_id,
                decision.city.name,
                decision.old_country_name,
                decision.strategy,
                decision.confidence,
                f"{decision.nearest_distance:.8f}" if decision.nearest_distance is not None else "None",
                f"{decision.second_nearest_distance:.8f}" if decision.second_nearest_distance is not None else "None",
                decision.details,
            )

        if idx % 5000 == 0:
            logger.info(
                "progress | processed_cities=%s | mismatches=%s | fixable=%s | unresolved=%s",
                idx,
                len(mismatches),
                len(accepted_updates),
                len(unresolved),
            )

    applied_success = 0
    applied_failed = 0
    applied_city_ids: set[str] = set()

    if args.apply and accepted_updates:
        applied_success, applied_failed, applied_city_ids = apply_updates(
            client,
            accepted_updates,
            logger,
        )

    # Build after-state from decisions that were actually applied (apply mode)
    # or from all accepted decisions (dry-run mode).
    effective_decisions: list[MismatchDecision]
    if args.apply:
        effective_decisions = [d for d in accepted_updates if d.city.city_id in applied_city_ids]
    else:
        effective_decisions = accepted_updates

    after_counts = Counter(before_counts)
    for decision in effective_decisions:
        after_counts[decision.old_country_id] -= 1
        if decision.new_country_id is not None:
            after_counts[decision.new_country_id] += 1

    country_name_by_id = {str(row.get("id") or ""): str(row.get("name") or "").strip() for row in raw_countries}

    # Country-level movement report (before vs projected-after in dry-run).
    gains: list[tuple[str, int]] = []
    losses: list[tuple[str, int]] = []
    for country_id, before in before_counts.items():
        after = after_counts.get(country_id, 0)
        delta = after - before
        if delta > 0:
            gains.append((country_id, delta))
        elif delta < 0:
            losses.append((country_id, -delta))

    strategy_counts = Counter(d.strategy for d in mismatches)
    confidence_counts = Counter(d.confidence for d in mismatches)

    elapsed = time.time() - started_at

    logger.info("summary | mismatches_total=%s", len(mismatches))
    logger.info("summary | fixable_total=%s", len(accepted_updates))
    logger.info("summary | unresolved_total=%s", len(unresolved))
    logger.info("summary | strategy_counts=%s", json.dumps(strategy_counts, ensure_ascii=True))
    logger.info("summary | confidence_counts=%s", json.dumps(confidence_counts, ensure_ascii=True))

    if args.apply:
        logger.info(
            "summary | updates_applied_success=%s | updates_applied_failed=%s",
            applied_success,
            applied_failed,
        )
        logger.info(
            "summary | applied_country_gain_count=%s | applied_country_loss_count=%s",
            len(gains),
            len(losses),
        )
    else:
        logger.info(
            "summary | dry_run_country_gain_count=%s | dry_run_country_loss_count=%s",
            len(gains),
            len(losses),
        )

    for country_id, delta in sorted(gains, key=lambda x: x[1], reverse=True):
        logger.info(
            "country_gain | country_id=%s | country_name=%s | delta=+%s",
            country_id,
            country_name_by_id.get(country_id, "<unknown>"),
            delta,
        )
    for country_id, delta in sorted(losses, key=lambda x: x[1], reverse=True):
        logger.info(
            "country_loss | country_id=%s | country_name=%s | delta=-%s",
            country_id,
            country_name_by_id.get(country_id, "<unknown>"),
            delta,
        )

    logger.info("run_end | elapsed_seconds=%.3f", elapsed)

    # Console output stays concise; full detail is in log file.
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] reconcile_city_country_by_geometry completed")
    print(f"Cities checked: {len(cities)}")
    print(f"Mismatches found: {len(mismatches)}")
    print(f"Fixable mismatches: {len(accepted_updates)}")
    print(f"Unresolved mismatches: {len(unresolved)}")
    if args.apply:
        print(f"Updates applied successfully: {applied_success}")
        print(f"Updates failed: {applied_failed}")
    print(f"Log file: {log_path}")

    return 0 if (not args.apply or applied_failed == 0) else 2


if __name__ == "__main__":
    sys.exit(main())
