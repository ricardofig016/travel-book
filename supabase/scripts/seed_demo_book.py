#!/usr/bin/env python3
"""
Seed demo book with markers and visits from demo_book_seed.json into Supabase.
Loads SUPABASE_URL and SUPABASE_SECRET_KEY from .env file.

This script:
1. Deletes the existing public demo book (cascade deletes markers, visits, members)
2. Creates a new public demo book with the admin user as creator
3. Adds the admin user as a book member (triggers user_profile creation)
4. Seeds markers and marker visits from demo_book_seed.json
"""

import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client


def load_demo_data() -> dict:
    """Load demo data from JSON file."""
    json_file = Path(__file__).parent.parent / "data" / "demo_book_seed.json"
    if not json_file.exists():
        print(f"✗ File not found: {json_file}")
        return {}

    with open(json_file, "r", encoding="utf-8") as f:
        return json.load(f)


def get_admin_user_id(supabase_client, admin_email: str) -> str | None:
    """Get admin user ID by email from auth.users."""
    try:
        # Service role key can query auth.users
        response = supabase_client.table("admin_users").select("user_id").execute()
        admin_users = response.data or []

        if not admin_users:
            print(f"✗ No admin users found in admin_users table")
            return None

        # For now, use the first (and typically only) admin
        admin_user_id = admin_users[0].get("user_id")
        if admin_user_id:
            print(f"✓ Found admin user: {admin_user_id}")
            return admin_user_id

        print(f"✗ Failed to extract user_id from admin_users")
        return None

    except Exception as e:
        print(f"✗ Error fetching admin user: {e}")
        return None


def delete_existing_public_book(supabase_client) -> bool:
    """Delete the existing public demo book (cascade delete clears markers, visits, members)."""
    try:
        # Find public book
        response = supabase_client.table("books").select("id").eq("is_public", True).execute()
        books = response.data or []

        if not books:
            print("ℹ No existing public book found")
            return True

        public_book_id = books[0].get("id")
        print(f"Deleting existing public book: {public_book_id}")

        # Delete the book (cascade deletes markers, marker_visits, book_members)
        supabase_client.table("books").delete().eq("id", public_book_id).execute()
        print(f"✓ Deleted public book and all related data (markers, visits, members)")
        return True

    except Exception as e:
        print(f"✗ Error deleting existing public book: {e}")
        return False


def create_demo_book(supabase_client, admin_user_id: str, book_data: dict) -> str | None:
    """Create the new public demo book with admin as creator."""
    try:
        book_row = {
            "name": book_data.get("name", "Around the World"),
            "is_public": True,
            "created_by": admin_user_id,
        }

        response = supabase_client.table("books").insert([book_row]).execute()
        data = response.data or []

        if not data:
            print("✗ Failed to create demo book")
            return None

        book_id = data[0].get("id")
        print(f"✓ Created public demo book: {book_id}")
        return book_id

    except Exception as e:
        print(f"✗ Error creating demo book: {e}")
        return None


def add_admin_as_book_member(supabase_client, book_id: str, admin_user_id: str) -> bool:
    """Add admin user as book member (triggers user_profile creation)."""
    try:
        member_row = {
            "book_id": book_id,
            "user_id": admin_user_id,
        }

        supabase_client.table("book_members").insert([member_row]).execute()
        print(f"✓ Added admin as book member")
        return True

    except Exception as e:
        print(f"✗ Error adding admin as book member: {e}")
        return False


def fetch_city_lookup(supabase_client) -> dict[tuple[str, str], tuple[str, str]]:
    """Fetch ALL cities with name_ascii and build multiple lookup keys."""
    try:
        print("Loading all cities from database...")

        all_cities = []
        offset = 0
        batch_size = 1000

        # Paginate through all cities (database has ~48k)
        while True:
            response = supabase_client.table("cities").select("id, name, name_ascii, country_id, countries(name)").range(offset, offset + batch_size - 1).execute()
            batch = response.data or []
            if not batch:
                break
            all_cities.extend(batch)
            offset += batch_size
            print(f"  Loaded {len(all_cities)} cities...", end="\r")

        # Build multiple lookup keys for flexible matching
        lookup: dict[tuple[str, str], tuple[str, str]] = {}

        for city in all_cities:
            city_id = city.get("id")
            city_name = (city.get("name") or "").strip()
            city_name_ascii = (city.get("name_ascii") or "").strip()
            country_data = city.get("countries", {})
            country_name = (country_data.get("name") or "").strip() if country_data else ""

            if not city_id or not country_name or not city_name:
                continue

            # Store both name and name_ascii for lookup
            key_exact = (country_name.lower(), city_name.lower())
            lookup[key_exact] = (city_id, city_name)

            if city_name_ascii and city_name_ascii != city_name:
                key_ascii = (country_name.lower(), city_name_ascii.lower())
                lookup[key_ascii] = (city_id, city_name_ascii)

        print(f"\n✓ Loaded {len(all_cities)} cities, {len(lookup)} lookup keys")
        return lookup

    except Exception as e:
        print(f"✗ Error fetching cities: {e}")
        import traceback

        traceback.print_exc()
        return {}


def resolve_city_id(country_name: str, city_name: str, city_lookup: dict[tuple[str, str], tuple[str, str]]) -> tuple[str, str] | None:
    """Resolve city_id from country_name and city_name with multiple strategies.

    Returns: (city_id, resolved_city_name) or None if not found
    """
    # Try 1: Exact match (both name and name_ascii already included in keys)
    key = (country_name.lower(), city_name.lower())
    if key in city_lookup:
        return city_lookup[key]

    # Try 2: Match on normalized ASCII (remove accents manually for fuzzy match)
    import unicodedata

    normalized = unicodedata.normalize("NFKD", city_name)
    ascii_city = normalized.encode("ascii", "ignore").decode("ascii").strip()
    if ascii_city and ascii_city.lower() != city_name.lower():
        key_ascii = (country_name.lower(), ascii_city.lower())
        if key_ascii in city_lookup:
            return city_lookup[key_ascii]

    # Try 3: Fuzzy partial match - any key that contains the search term
    search_key = (country_name.lower(), city_name.lower())
    for lookup_key, value in city_lookup.items():
        if lookup_key[0] == search_key[0]:  # Same country
            # Check if search term is in the lookup key name
            if city_name.lower() in lookup_key[1] or lookup_key[1] in city_name.lower():
                return value

    return None


def create_marker(supabase_client, book_id: str, city_id: str, marker_data: dict) -> str | None:
    """Create a marker for a city in a book."""
    try:
        marker_row = {
            "book_id": book_id,
            "city_id": city_id,
            "visited": marker_data.get("visited", False),
            "favorite": marker_data.get("favorite", False),
            "want": marker_data.get("want", False),
            "notes": marker_data.get("notes"),
            "companions": marker_data.get("companions", []),
            "activities": marker_data.get("activities", []),
        }

        response = supabase_client.table("markers").insert([marker_row]).execute()
        data = response.data or []

        if not data:
            print(f"  ✗ Failed to create marker for city {marker_data.get('city_name')}")
            return None

        marker_id = data[0].get("id")
        return marker_id

    except Exception as e:
        print(f"  ✗ Error creating marker: {e}")
        return None


def create_marker_visits(supabase_client, marker_id: str, visits: list[dict]) -> bool:
    """Create visit records for a marker."""
    if not visits:
        return True  # No visits to create

    try:
        visit_rows = []
        for visit in visits:
            start_date = visit.get("start_date")
            end_date = visit.get("end_date")

            if not start_date or not end_date:
                continue

            visit_rows.append(
                {
                    "marker_id": marker_id,
                    "start_date": start_date,
                    "end_date": end_date,
                }
            )

        if visit_rows:
            supabase_client.table("marker_visits").insert(visit_rows).execute()

        return True

    except Exception as e:
        print(f"  ✗ Error creating marker visits: {e}")
        return False


def seed_demo_markers(supabase_client, book_id: str, markers_data: list[dict]) -> int:
    """Seed all demo markers and their visits. Returns count of successful markers."""
    city_lookup = fetch_city_lookup(supabase_client)
    if not city_lookup:
        print("✗ Failed to load city lookup")
        return 0

    successful_count = 0

    print(f"\nSeeding {len(markers_data)} markers...")
    for marker_data in markers_data:
        country_name = marker_data.get("country_name", "").strip()
        city_name = marker_data.get("city_name", "").strip()

        if not country_name or not city_name:
            print(f"✗ Invalid marker data (missing country or city)")
            continue

        # Resolve city ID using multi-strategy matching
        resolution = resolve_city_id(country_name, city_name, city_lookup)
        if not resolution:
            print(f"✗ City not found: {city_name}, {country_name}")
            continue

        city_id, resolved_name = resolution

        # Create marker
        marker_id = create_marker(supabase_client, book_id, city_id, marker_data)
        if not marker_id:
            continue

        # Create visits
        visits = marker_data.get("visits", [])
        if create_marker_visits(supabase_client, marker_id, visits):
            visit_count = len(visits)
            visited_str = "visited" if marker_data.get("visited") else "not visited"
            print(f"✓ {resolved_name}, {country_name} ({visited_str}, {visit_count} visit periods)")
            successful_count += 1

    return successful_count


def main():
    # Load .env file from project root
    env_path = Path(__file__).parent.parent.parent / ".env"
    load_dotenv(env_path)

    # Get Supabase credentials from environment
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SECRET_KEY")

    if not supabase_url or not supabase_key:
        print("✗ Missing environment variables in .env:")
        print("  SUPABASE_URL and SUPABASE_SECRET_KEY")
        print(f"\nLooking for .env at: {env_path}")
        return 1

    print("=== Travel Book Demo Book Seeder ===\n")

    # Load demo data from JSON
    demo_data = load_demo_data()
    if not demo_data:
        return 1

    # Initialize Supabase client
    try:
        supabase = create_client(supabase_url, supabase_key)
        print("✓ Connected to Supabase\n")
    except Exception as e:
        print(f"✗ Failed to connect to Supabase: {e}")
        return 1

    # Get admin user ID
    admin_user_id = get_admin_user_id(supabase, "ricardocastrofigueiredo@gmail.com")
    if not admin_user_id:
        print("✗ Could not find admin user")
        return 1

    # Delete existing public book
    print("\nCleaning up existing demo book...")
    if not delete_existing_public_book(supabase):
        return 1

    # Create new demo book
    print("\nCreating new demo book...")
    book_data = demo_data.get("book", {})
    book_id = create_demo_book(supabase, admin_user_id, book_data)
    if not book_id:
        return 1

    # Add admin as book member
    if not add_admin_as_book_member(supabase, book_id, admin_user_id):
        return 1

    # Seed markers
    markers_data = demo_data.get("markers", [])
    successful_markers = seed_demo_markers(supabase, book_id, markers_data)

    print()
    print("=" * 70)
    print(f"Demo book seeding completed!")
    print(f"  Book ID: {book_id}")
    print(f"  Markers created: {successful_markers}/{len(markers_data)}")
    print("=" * 70)

    if successful_markers == len(markers_data):
        print("✓ All markers seeded successfully!")
        return 0
    else:
        print(f"⚠ {len(markers_data) - successful_markers} markers failed to seed")
        return 0  # Still exit 0 as partial success is acceptable


if __name__ == "__main__":
    sys.exit(main())
