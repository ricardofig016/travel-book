# Seed & Fetch Scripts

Python scripts for fetching data from external APIs and seeding Supabase.

## Usage

All scripts load credentials from the project root `.env` file.

### Countries

**Step 1: Fetch countries from REST Countries API**

```bash
python fetch_countries.py
```

- Fetches all 250 country details
- Saves to `../data/countries_seed.json`
- Takes ~5 minutes (rate-limited to 60 requests/min)

**Step 2: Seed to Supabase**

```bash
python seed_countries.py
```

- Inserts 250 countries into `countries` table
- Uses service role key from `.env`

### Country Shapes

`visvalingam-weighted_1.8pct_keepshapes_clean.geojson` already exists in `../data`.

**Optional cleanup/normalization (recommended before seeding shapes)**

```bash
python normalize_country_shapes_geojson.py
```

- Removes GeoJSON features that do not map to a country in the `countries` table (e.g., disputed/non-DB shapes)
- Normalizes feature `name`, `ISO3166-1-Alpha-2`, and `ISO3166-1-Alpha-3` from DB values
- Fixes placeholder ISO codes like `-99` via the same match strategy used by shape seeding
- Tries to dissolve removed shapes into adjacent parent countries to prevent empty map holes (requires `shapely`)
- Prints detailed per-country logs (found, kept, updated, removed) and summary diagnostics
- Default output: `../data/visvalingam-weighted_1.8pct_keepshapes_clean.db-normalized.geojson`

Install dissolve dependency (one time):

```bash
pip install shapely
```

To overwrite the source file in-place:

```bash
python normalize_country_shapes_geojson.py --in-place
```

**Seed to Supabase**

```bash
python seed_country_shapes.py
```

- Updates `countries.geometry` (JSONB) using feature geometries from GeoJSON
- Matches rows by ISO3 first, then ISO2, then country name
- Prints match and update summary, including unmatched feature sample

### Cities

**Step 1: Fetch cities from world-cities dataset**

```bash
python fetch_cities.py
```

- Fetches city data from `../data/worldcities.csv`
- Processes and enriches city information
- Saves to `../data/cities_seed.json`

**Step 2: Seed to Supabase**

```bash
python seed_cities.py
```

- Inserts cities into `cities` table
- Links to countries via country_id lookup
- Uses upsert for idempotent re-runs
- Validates coordinates and city names

### Currencies

**Step 1: Fetch from REST Countries API**

```bash
python fetch_currencies.py
```

- Uses country codes from `../data/countries_seed.json`
- Extracts currency data for each country
- Saves to `../data/currencies_seed.json`
- Takes ~5 minutes

**Step 2: Seed to Supabase**

```bash
python seed_currencies.py
```

- Inserts currencies into `currencies` table
- Links to countries via country_id lookup
- Handles formatting and validation

### Dishes

`dishes_seed.json` already exists in `../data`.

**Seed to Supabase**

```bash
python seed_dishes.py
```

- Inserts or updates dishes in `dishes` table
- Resolves `country_id` by matching country names from `countries` table
- Uses upsert on `(name, country_id)` for idempotent re-runs
- Logs unmatched countries and skipped rows

## Maintenance & Validation Scripts

### City-Country Reconciliation

Validates and repairs city-to-country assignments by comparing city coordinates against country boundary geometries. Use this after city or country geometry changes to ensure data consistency.

**Dry-run (validate without applying changes)**

```bash
python reconcile_city_country_by_geometry.py
```

**Apply updates to database**

```bash
python reconcile_city_country_by_geometry.py --apply
```

**With custom tolerance settings**

```bash
python reconcile_city_country_by_geometry.py --apply --nearest-tolerance-deg 0.08 --nearest-margin-ratio 0.6
```

**Command-line options:**

- `--apply`: Apply discovered fixes to the database. Without this flag, script runs in dry-run mode.
- `--nearest-tolerance-deg FLOAT`: Max geometry distance (degrees) for nearest-fallback assignment when a city point is not inside any polygon boundary. Default: `0.08` (~9 km at equator). Lower values = stricter.
- `--nearest-margin-ratio FLOAT`: Confidence margin for nearest fallback: nearest distance must be ≤ ratio × second_nearest distance. Default: `0.6`. Lower values = stricter (requires clear winner).
- `--max-cities INT`: Optional safety limit for number of cities to process (0 = all). Default: `0` (process all).
- `--source-geojson PATH`: Original GeoJSON source to normalize before reconciliation. Default: `public/assets/data/geo/countries.geojson`. The script applies the same normalization + dissolve pipeline as `normalize_country_shapes_geojson.py` to ensure consistent geometry processing.

**How it works:**

1. **Loads source GeoJSON** and normalizes it through the canonical matching + dissolve pipeline (same as seed process).
2. **Fetches all cities and countries** from Supabase (paginated, no truncation at 1000 rows).
3. **For each city:**
   - **Exact match**: Check if city point is covered by exactly one country polygon.
     - If yes and matches current assignment: no change needed.
     - If yes and differs: flag as `unique-cover` (high confidence).
     - If covered by multiple: flag as `ambiguous-overlap` (low confidence, skip).
   - **Fallback**: If point is not inside any polygon:
     - Find nearest country by geometry distance (using STRtree spatial index).
     - If nearest ≤ tolerance AND nearest ≤ (second_nearest × margin_ratio): flag as `nearest-fallback` (medium confidence).
     - Otherwise: flag as `unresolved-outside` (low confidence, skip).
   - **Vatican City override**: If city name is "Vatican City", force assignment to Vatican City country (ISO2 VA) regardless of geometry.
4. **Decision categories:**
   - `unique-cover`: Point covered by exactly one polygon → high confidence → auto-fix.
   - `nearest-fallback`: Point outside all polygons but nearest country passes checks → medium confidence → auto-fix.
   - `ambiguous-overlap`: Point covered by multiple polygons → skip (manual review needed).
   - `unresolved-outside`: Point outside all polygons and nearest fails checks → skip (manual review needed).
   - `manual-override-vatican`: Special case for Vatican City city (always mapped to VA).
5. **Output:**
   - Detailed log file: `../logs/reconcile-city-country-YYYYMMDD-HHMMSS.log`
   - Per-city decision lines (strategy, confidence, distances, rationale)
   - Country-level delta report (gains/losses by country)
   - In apply mode: summary of successful/failed updates

**Example output (dry-run):**

```
[DRY-RUN] reconcile_city_country_by_geometry completed
Cities checked: 48031
Mismatches found: 357
Fixable mismatches: 349
Unresolved mismatches: 8
Log file: supabase/logs/reconcile-city-country-20260330-012345.log
```

**Example output (apply mode):**

```
[APPLY] reconcile_city_country_by_geometry completed
Cities checked: 48031
Mismatches found: 357
Fixable mismatches: 349
Unresolved mismatches: 8
Updates applied successfully: 349
Updates failed: 0
Log file: supabase/logs/reconcile-city-country-20260330-014625.log
```

**Requirements:** `shapely` (for geometric operations and spatial indexing). Install with:

```bash
pip install shapely
```

**Performance:** ~30–60 seconds for full 48k-city dataset on modern hardware.

## Available Scripts

| Script                   | Purpose                                    | Input                                                           | Output                 |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------------- | ---------------------- |
| `fetch_countries.py`     | Query REST Countries API for all countries | (API)                                                           | `countries_seed.json`  |
| `fetch_cities.py`        | Extract cities from world-cities dataset   | `worldcities.csv`                                               | `cities_seed.json`     |
| `fetch_currencies.py`    | Extract currencies from country data       | `countries_seed.json`                                           | `currencies_seed.json` |
| `seed_countries.py`      | Insert countries into Supabase             | `countries_seed.json` + `.env`                                  | Database               |
| `seed_country_shapes.py` | Update `countries.geometry` from GeoJSON   | `visvalingam-weighted_1.8pct_keepshapes_clean.geojson` + `.env` | Database               |
| `seed_cities.py`         | Insert cities into Supabase                | `cities_seed.json` + `.env`                                     | Database               |
| `seed_currencies.py`     | Insert currencies into Supabase            | `currencies_seed.json` + `.env`                                 | Database               |
| `seed_dishes.py`         | Insert/update dishes into Supabase         | `dishes_seed.json` + `.env`                                     | Database               |

## Requirements

- Python 3.7+
- `python-dotenv` (for loading `.env`)
- `supabase` (for Supabase client)
- `requests` (for REST Countries API)

Install dependencies:

```bash
pip install python-dotenv supabase requests
```

## Environment Variables

All scripts require `.env` in the project root with:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx
```

The service role key (`SUPABASE_SECRET_KEY`) is needed for write operations.

## Troubleshooting

### "No currencies found"

The `currencies` field was not saved in `countries_seed.json`. Run `fetch_currencies.py` to extract from the API.

### "Country not found"

A country code in the data doesn't match existing countries table. Check country codes match ISO 3166-1 alpha-2.

### Rate limit errors

The scripts respect API rate limits (60 req/min). If hitting issues:

- Reduce `RATE_LIMIT_DELAY` in the script (be careful)
- Wait and retry

## Data Flow

```
REST Countries API
    ↓
fetch_countries.py → countries_seed.json → seed_countries.py → Supabase
    ↓
visvalingam-weighted_1.8pct_keepshapes_clean.geojson → seed_country_shapes.py → countries.geometry
    ↓
fetch_currencies.py → currencies_seed.json → seed_currencies.py → Supabase
    ↓
fetch_cities.py → cities_seed.json → seed_cities.py → Supabase
```

## Future Scripts

- `fetch_cities.py` – Parse `worldcities.csv`
- `seed_cities.py` – Insert cities with country lookups
