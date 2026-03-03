#!/usr/bin/env python3
"""
Comprehensive Supabase connection test.
Tests all tables for read access and basic health checks.
Uses the publishable anon key (same as browser would use).
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# Load .env from project root
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
ANON_KEY = "sb_publishable_JWU45WJwVbBES-Fbh32zSg_r5nMQbgo"

# List of tables with their primary key columns
TABLES = {
    "countries": "id",
    "cities": "id",
    "currencies": "id",
    "user_profiles": "user_id",  # Uses user_id as PK
    "admin_users": "user_id",  # Uses user_id as PK
    "dishes": "id",
    "books": "id",
    "book_members": "book_id",  # Composite PK, select first column
    "book_tried_dishes": "id",
    "markers": "id",
    "marker_visits": "id",
    "photos": "id",
}


class SupabaseHealthCheck:
    def __init__(self, url: str, key: str):
        self.client = create_client(url, key)
        self.results = {}
        self.passed = 0
        self.failed = 0

    def test_table(self, table_name: str, pk_column: str) -> dict:
        """Test a single table for read access and count rows."""
        try:
            response = self.client.table(table_name).select(pk_column, count="exact").execute()
            count = response.count or 0

            return {
                "status": "✓",
                "count": count,
                "error": None,
            }
        except Exception as e:
            return {
                "status": "✗",
                "count": 0,
                "error": str(e),
            }

    def run_all_tests(self) -> bool:
        """Test all tables and return overall success status."""
        print("=" * 70)
        print("SUPABASE CONNECTION & TABLE HEALTH CHECK")
        print("=" * 70)
        print(f"URL: {SUPABASE_URL}")
        print(f"Auth: Anon (browser-level)")
        print()

        all_passed = True

        for table_name, pk_column in TABLES.items():
            result = self.test_table(table_name, pk_column)
            self.results[table_name] = result

            status = result["status"]
            count = result["count"]

            if result["error"]:
                print(f"{status} {table_name:<20} Error: {result['error']}")
                self.failed += 1
                all_passed = False
            else:
                print(f"{status} {table_name:<20} Rows: {count:>6}")
                self.passed += 1

        print()
        print("=" * 70)
        print(f"SUMMARY: {self.passed} passed, {self.failed} failed")
        print("=" * 70)

        return all_passed

    def print_details(self):
        """Print detailed error information."""
        errors = {table: info["error"] for table, info in self.results.items() if info["error"]}

        if errors:
            print("\nDETAILED ERRORS:")
            print("-" * 70)
            for table, error in errors.items():
                print(f"\n{table}:")
                print(f"  {error}")


def main():
    if not SUPABASE_URL:
        print("✗ SUPABASE_URL not found in .env")
        return 1

    checker = SupabaseHealthCheck(SUPABASE_URL, ANON_KEY)
    success = checker.run_all_tests()

    if not success:
        checker.print_details()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
