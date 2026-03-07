# Supabase Configuration & Data

Organized Supabase setup for the Travel Book project.

## Folder Structure

```
supabase/
├── schema.sql              # Main database schema (source of truth)
├── diagram.png             # ER diagram for schema visualization
│
├── migrations/             # Database migration history
│                           # (Supabase CLI manages versions here)
│
├── data/                   # Seed data files (JSON/CSV)
│   ├── countries_seed.json        # 250 countries from REST Countries API
│   ├── currencies_seed.json       # 268 currencies extracted from countries
│   ├── cities_seed.json           # ~48k cities from SimpleMaps worldcities.csv
│   ├── dishes_seed.json           # Dishes from TasteAtlas
│   ├── visvalingam-weighted_1.8pct_keepshapes_clean.geojson # Country boundary shapes for countries.geometry
│   └── worldcities.csv            # ~48k cities from SimpleMaps (source data)
│
├── scripts/                # Python fetch & seed scripts
│   ├── fetch_countries.py         # Fetch countries from REST Countries API
│   ├── fetch_cities.py            # Extract cities from worldcities.csv
│   ├── fetch_currencies.py        # Fetch currencies from REST Countries API
│   ├── seed_countries.py          # Insert countries into Supabase
│   ├── seed_country_shapes.py     # Update countries.geometry from GeoJSON
│   ├── seed_cities.py             # Insert cities into Supabase
│   ├── seed_currencies.py         # Insert currencies into Supabase
│   ├── seed_dishes.py             # Insert dishes into Supabase
│   └── README.md                  # Script usage guide
│
├── test/                   # Test suite for database health checks
│   ├── test_connection.py         # Comprehensive connection & table health check
│   ├── README.md                  # Test documentation
│   └── __init__.py
│
└── sql/                    # Utility & debugging SQL scripts (archived)
    ├── fix_rls_recursion.sql      # Fixed RLS policy recursion issue
    └── check_rls_policies.sql     # Diagnostic query for RLS policies
```

## Quick Guide

### Running Tests

```bash
python test/test_connection.py
```

Shows row counts for all 12 tables.

### Seeding Data

#### Countries (already complete)

```bash
python scripts/seed_countries.py
```

#### Currencies (already complete)

```bash
python scripts/fetch_currencies.py  # If needed to regenerate
python scripts/seed_currencies.py
```

#### Cities

```bash
python scripts/fetch_cities.py
python scripts/seed_cities.py
```

#### Dishes

```bash
python scripts/seed_dishes.py
```

#### Country Shapes (countries.geometry)

```bash
python scripts/seed_country_shapes.py
```

- Reads `data/visvalingam-weighted_1.8pct_keepshapes_clean.geojson`
- Matches countries by ISO3, then ISO2, then name
- Updates `countries.geometry` (JSONB)

### Schema Deployment

The schema is deployed via `npx supabase db push` and migrations are managed in the `migrations/` folder.

To manually apply fixes to production:

- Edit `schema.sql` or create a new migration
- Run `npx supabase migration new <name>`
- Update the migration file with your changes
- Run `npx supabase db push`

## Data Sources

- **Countries & Currencies**: [REST Countries API](https://restcountries.com/)
- **Cities**: [SimpleMaps worldcities.csv](https://simplemaps.com/data/world-cities)
- **Country boundaries**: [DataHub geo-countries](https://datahub.io/core/geo-countries) (processed into `visvalingam-weighted_1.8pct_keepshapes_clean.geojson` using mapshaper)
- **Dishes**: Local `country_dishes.json` (from TasteAtlas)
- **Currency Symbols & Names**: Extracted from REST Countries API

## Notes

- All seeding scripts use credentials from `.env` (Supabase service role key)
- Tests use the public anon key (same as browser)
- RLS policies prevent unauthorized access but allow public read on countries/cities/dishes
