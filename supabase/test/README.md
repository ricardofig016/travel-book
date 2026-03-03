# Supabase Test Suite

Automated tests for verifying Supabase database connectivity and health.

## Usage

### Run All Tests

Execute all test suites at once:

```bash
cd supabase/test
python run_all_tests.py
```

This runs both the anon connection tests and role-based tests, providing a combined summary.

---

### Connection Health Check

Test all tables for read access and row count:

```bash
cd supabase/test
python test_connection.py
```

### Role-Based Connection Test Set (Admin + Owner)

Test Supabase access using authenticated role credentials:

```bash
cd supabase/test
python test_connection_roles.py
```

Required `.env` values (at project root):

- `SUPABASE_URL`
- `SUPABASE_ADMIN_EMAIL`
- `SUPABASE_ADMIN_PASSWORD`
- `SUPABASE_OWNER_EMAIL`
- `SUPABASE_OWNER_PASSWORD`

Optional:

- `SUPABASE_ANON_KEY` (falls back to current publishable key if omitted)

What this test set validates:

- Login succeeds for each configured role.
- Public reference data is readable when authenticated.
- `is_admin` RPC matches expected role behavior.
- `admin_users` table visibility matches admin/non-admin policy.

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
