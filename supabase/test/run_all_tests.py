#!/usr/bin/env python3
"""
Run all Supabase test suites.
Executes both anon connection tests and role-based tests.
"""

import sys
from pathlib import Path

# Add test directory to path for imports
test_dir = Path(__file__).parent
sys.path.insert(0, str(test_dir))

from test_connection import main as test_connection_main
from test_connection_roles import main as test_connection_roles_main


def main() -> int:
    print("=" * 70)
    print("RUNNING ALL SUPABASE TEST SUITES")
    print("=" * 70)
    print()

    results = []

    # Run anon connection tests
    print("📋 Test Suite 1: Anon Connection & Table Health Check")
    print()
    exit_code_1 = test_connection_main()
    results.append(("Anon Connection Tests", exit_code_1 == 0))
    print()

    # Run role-based tests
    print("📋 Test Suite 2: Role-Based Connection Tests")
    print()
    exit_code_2 = test_connection_roles_main()
    results.append(("Role-Based Tests", exit_code_2 == 0))
    print()

    # Summary
    print("=" * 70)
    print("ALL SUITES SUMMARY")
    print("=" * 70)
    for suite_name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{status:<12} {suite_name}")
    print("=" * 70)

    all_passed = all(passed for _, passed in results)
    if all_passed:
        print("✓ All test suites passed")
        return 0
    else:
        print("✗ Some test suites failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
