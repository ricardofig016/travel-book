#!/usr/bin/env python3
"""
Role-based Supabase connection test.

This test set authenticates with real user credentials and validates that
role-specific access behaves as expected for:
- admin credentials (expected is_admin = true)
- owner credentials (expected is_admin = false)
"""

import os
import sys
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client


# Load .env from project root
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or "sb_publishable_JWU45WJwVbBES-Fbh32zSg_r5nMQbgo"


@dataclass(frozen=True)
class RoleCredential:
    name: str
    email: str
    password: str
    expect_admin: bool


class RoleConnectionTestSet:
    def __init__(self, url: str, anon_key: str):
        self.url = url
        self.anon_key = anon_key
        self.total_passed = 0
        self.total_failed = 0

    def _login(self, creds: RoleCredential) -> tuple[Client, str]:
        client = create_client(self.url, self.anon_key)
        auth = client.auth.sign_in_with_password(
            {
                "email": creds.email,
                "password": creds.password,
            }
        )

        if not auth.user:
            raise RuntimeError(f"No authenticated user returned for role '{creds.name}'")

        return client, auth.user.id

    @staticmethod
    def _assert(condition: bool, message: str):
        if not condition:
            raise AssertionError(message)

    def _run_public_reference_read_test(self, client: Client):
        countries = client.table("countries").select("id", count="exact").limit(1).execute()
        self._assert(countries.count is not None, "Failed to read public reference table 'countries'")

    def _run_is_admin_test(self, client: Client, user_id: str, expect_admin: bool):
        response = client.rpc("is_admin", {"user_uid": user_id}).execute()
        is_admin = bool(response.data)
        self._assert(
            is_admin == expect_admin,
            f"is_admin({user_id}) expected {expect_admin} but got {is_admin}",
        )

    def _run_admin_users_visibility_test(self, client: Client, user_id: str, expect_admin: bool):
        response = client.table("admin_users").select("user_id").eq("user_id", user_id).limit(1).execute()

        data = response.data or []
        if expect_admin:
            self._assert(len(data) == 1, "Admin user could not read own row in admin_users")
        else:
            self._assert(len(data) == 0, "Non-admin user should not read rows from admin_users")

    def _run_books_access_smoke_test(self, client: Client):
        books = client.table("books").select("id", count="exact").limit(1).execute()
        self._assert(books.count is not None, "Failed to query books table with authenticated user")

    def run_role_tests(self, creds: RoleCredential) -> bool:
        tests = [
            ("public reference read", self._run_public_reference_read_test),
            ("books query smoke test", self._run_books_access_smoke_test),
        ]

        print(f"\nRole: {creds.name}")
        print("-" * 70)

        try:
            client, user_id = self._login(creds)
            print(f"✓ login ({creds.email})")
            self.total_passed += 1
        except Exception as exc:
            print(f"✗ login failed ({creds.email}): {exc}")
            self.total_failed += 1
            return False

        role_ok = True

        for test_name, test_fn in tests:
            try:
                test_fn(client)
                print(f"✓ {test_name}")
                self.total_passed += 1
            except Exception as exc:
                print(f"✗ {test_name}: {exc}")
                self.total_failed += 1
                role_ok = False

        try:
            self._run_is_admin_test(client, user_id, creds.expect_admin)
            print("✓ is_admin rpc check")
            self.total_passed += 1
        except Exception as exc:
            print(f"✗ is_admin rpc check: {exc}")
            self.total_failed += 1
            role_ok = False

        try:
            self._run_admin_users_visibility_test(client, user_id, creds.expect_admin)
            print("✓ admin_users visibility check")
            self.total_passed += 1
        except Exception as exc:
            print(f"✗ admin_users visibility check: {exc}")
            self.total_failed += 1
            role_ok = False

        return role_ok

    def run(self, credentials: list[RoleCredential]) -> bool:
        print("=" * 70)
        print("SUPABASE ROLE-BASED CONNECTION TEST SET")
        print("=" * 70)
        print(f"URL: {self.url}")
        print(f"Roles configured: {', '.join([c.name for c in credentials])}")

        all_passed = True
        for creds in credentials:
            role_passed = self.run_role_tests(creds)
            all_passed = all_passed and role_passed

        print("\n" + "=" * 70)
        print(f"SUMMARY: {self.total_passed} passed, {self.total_failed} failed")
        print("=" * 70)

        return all_passed


def build_credentials_from_env() -> list[RoleCredential]:
    creds: list[RoleCredential] = []

    admin_email = os.getenv("SUPABASE_ADMIN_EMAIL")
    admin_password = os.getenv("SUPABASE_ADMIN_PASSWORD")
    if admin_email and admin_password:
        creds.append(
            RoleCredential(
                name="admin",
                email=admin_email,
                password=admin_password,
                expect_admin=True,
            )
        )

    owner_email = os.getenv("SUPABASE_OWNER_EMAIL")
    owner_password = os.getenv("SUPABASE_OWNER_PASSWORD")
    if owner_email and owner_password:
        creds.append(
            RoleCredential(
                name="owner",
                email=owner_email,
                password=owner_password,
                expect_admin=False,
            )
        )

    return creds


def main() -> int:
    if not SUPABASE_URL:
        print("✗ SUPABASE_URL not found in .env")
        return 1

    credentials = build_credentials_from_env()
    if not credentials:
        print("✗ No role credentials found in .env")
        print("  Add one or both credential sets:")
        print("  - SUPABASE_ADMIN_EMAIL + SUPABASE_ADMIN_PASSWORD")
        print("  - SUPABASE_OWNER_EMAIL + SUPABASE_OWNER_PASSWORD")
        return 1

    tester = RoleConnectionTestSet(SUPABASE_URL, SUPABASE_ANON_KEY)
    success = tester.run(credentials)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
