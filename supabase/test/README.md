# Supabase Test Suite

Automated tests for verifying Supabase database connectivity and health.

## Usage

### Connection Health Check

Test all tables for read access and row count:

```bash
cd supabase/test
python test_connection.py
```

**Output:**

- ✓ All tables accessible
- Row counts for each table
- Detailed error messages if any table fails

### What It Tests

The health check verifies:

- Connection to Supabase (using anon key, same as browser)
- Read access on all 12 tables
- Proper RLS policy enforcement
- Row counts for data validation

### Tables Checked

- `countries` - 250 seed rows expected
- `cities` - (seeds from worldcities.csv for all countries)
- `currencies` - (auto-generated from countries)
- `user_profiles` - (created on user signup)
- `admin_users` - (created manually or via seeding)
- `dishes` - (seeds from country_dishes.json)
- `books` - (user-created)
- `book_members` - (user-book associations)
- `book_tried_dishes` - (user's favorite dishes per book)
- `markers` - (locations marked on map)
- `marker_visits` - (visit periods for markers)
- `photos` - (photos from Cloudinary)

### Troubleshooting

If a table fails:

1. **Check RLS policies** - Ensure `CREATE POLICY` statements ran successfully
2. **Check data** - Verify seeding scripts completed
3. **Check schema** - Ensure all `CREATE TABLE` statements completed

Run the connection test to diagnose errors without touching the schema.
