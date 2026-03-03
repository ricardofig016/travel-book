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

## Available Scripts

| Script                | Purpose                                    | Input                           | Output                 |
| --------------------- | ------------------------------------------ | ------------------------------- | ---------------------- |
| `fetch_countries.py`  | Query REST Countries API for all countries | (API)                           | `countries_seed.json`  |
| `fetch_currencies.py` | Extract currencies from country data       | `countries_seed.json`           | `currencies_seed.json` |
| `seed_countries.py`   | Insert countries into Supabase             | `countries_seed.json` + `.env`  | Database               |
| `seed_currencies.py`  | Insert currencies into Supabase            | `currencies_seed.json` + `.env` | Database               |
| `seed_dishes.py`      | Insert/update dishes into Supabase         | `dishes_seed.json` + `.env`     | Database               |

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
SUPABASE_KEY=sb_secret_xxx
```

The service role key (`SUPABASE_KEY`) is needed for write operations.

## Troubleshooting

### "No currencies found"

The `currencies` field was not saved in `countries_seed.json`. Run `fetch_currencies.py` to extract from the API.

### "Country not found"

A country code in the data doesn't match existing countries table. Check country codes match ISO 3166-1 alpha-2.

### Rate limit errors

The scripts respect API rate limits (60 req/min). If hitting issues:

- Reduce `RATE_LIMIT_DELAY` in the script (be careful)
- Wait and retry

## Performance

- `fetch_countries.py`: ~5 min (250 API calls)
- `fetch_currencies.py`: ~5 min (250 API calls)
- `seed_countries.py`: <1 sec (batch insert)
- `seed_currencies.py`: <1 sec (batch insert)

## Data Flow

```
REST Countries API
    ↓
fetch_countries.py → countries_seed.json → seed_countries.py → Supabase
    ↓
fetch_currencies.py → currencies_seed.json → seed_currencies.py → Supabase
```

## Future Scripts

- `fetch_cities.py` – Parse `worldcities.csv`
- `seed_cities.py` – Insert cities with country lookups
