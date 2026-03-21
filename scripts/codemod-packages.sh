#!/bin/bash
# Codemod: Rewrite @/lib/* imports INSIDE package source files
# Run after codemod-imports.sh
# These are cross-package imports within packages/*/src/

set -euo pipefail

echo "=== Package Cross-Import Codemod ==="

# For each package, rewrite @/lib/* imports to @twicely/*
for pkg_dir in packages/*/src; do
  pkg_name=$(basename $(dirname "$pkg_dir"))

  # Skip if no .ts files
  file_count=$(find "$pkg_dir" -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l)
  [ "$file_count" -eq 0 ] && continue

  echo "Processing @twicely/$pkg_name ($file_count files)..."

  find "$pkg_dir" -name "*.ts" -o -name "*.tsx" | while read f; do
    # DB imports
    sed -i "s|from '@/lib/db/schema'|from '@twicely/db/schema'|g" "$f"
    sed -i "s|from '@/lib/db/schema/\([^']*\)'|from '@twicely/db/schema'|g" "$f"
    sed -i "s|from '@/lib/db'|from '@twicely/db'|g" "$f"

    # Auth
    sed -i "s|from '@/lib/auth/\([^']*\)'|from '@twicely/auth/\1'|g" "$f"
    sed -i "s|from '@/lib/auth'|from '@twicely/auth'|g" "$f"

    # CASL
    sed -i "s|from '@/lib/casl/\([^']*\)'|from '@twicely/casl/\1'|g" "$f"
    sed -i "s|from '@/lib/casl'|from '@twicely/casl'|g" "$f"

    # Logger
    sed -i "s|from '@/lib/logger'|from '@twicely/logger'|g" "$f"

    # Utils
    sed -i "s|from '@/lib/utils/\([^']*\)'|from '@twicely/utils/\1'|g" "$f"
    sed -i "s|from '@/lib/utils'|from '@twicely/utils'|g" "$f"

    # Cache
    sed -i "s|from '@/lib/cache/valkey'|from '@twicely/db/cache'|g" "$f"

    # Queries/platform-settings
    sed -i "s|from '@/lib/queries/platform-settings'|from '@twicely/db/queries/platform-settings'|g" "$f"

    # Cross-package: commerce, stripe, notifications, etc.
    sed -i "s|from '@/lib/commerce/\([^']*\)'|from '@twicely/commerce/\1'|g" "$f"
    sed -i "s|from '@/lib/stripe/\([^']*\)'|from '@twicely/stripe/\1'|g" "$f"
    sed -i "s|from '@/lib/notifications/\([^']*\)'|from '@twicely/notifications/\1'|g" "$f"
    sed -i "s|from '@/lib/storage/\([^']*\)'|from '@twicely/storage/\1'|g" "$f"
    sed -i "s|from '@/lib/realtime/\([^']*\)'|from '@twicely/realtime/\1'|g" "$f"
    sed -i "s|from '@/lib/jobs/\([^']*\)'|from '@twicely/jobs/\1'|g" "$f"
    sed -i "s|from '@/lib/subscriptions/\([^']*\)'|from '@twicely/subscriptions/\1'|g" "$f"
    sed -i "s|from '@/lib/finance/\([^']*\)'|from '@twicely/finance/\1'|g" "$f"
    sed -i "s|from '@/lib/search/\([^']*\)'|from '@twicely/search/\1'|g" "$f"
    sed -i "s|from '@/lib/email/\([^']*\)'|from '@twicely/email/\1'|g" "$f"
    sed -i "s|from '@/lib/crosslister/\([^']*\)'|from '@twicely/crosslister/\1'|g" "$f"
    sed -i "s|from '@/lib/encryption'|from '@twicely/db/encryption'|g" "$f"

    # UI
    sed -i "s|from '@/components/ui/\([^']*\)'|from '@twicely/ui/\1'|g" "$f"

    # Mock patterns in test files
    sed -i "s|vi.mock('@/lib/db|vi.mock('@twicely/db|g" "$f"
    sed -i "s|vi.mock('@/lib/casl|vi.mock('@twicely/casl|g" "$f"
    sed -i "s|vi.mock('@/lib/auth|vi.mock('@twicely/auth|g" "$f"
    sed -i "s|vi.mock('@/lib/logger|vi.mock('@twicely/logger|g" "$f"
    sed -i "s|vi.mock('@/lib/cache|vi.mock('@twicely/db/cache|g" "$f"
    sed -i "s|vi.mock('@/lib/queries/platform-settings|vi.mock('@twicely/db/queries/platform-settings|g" "$f"
    sed -i "s|vi.mock('@/lib/commerce|vi.mock('@twicely/commerce|g" "$f"
    sed -i "s|vi.mock('@/lib/stripe|vi.mock('@twicely/stripe|g" "$f"
    sed -i "s|vi.mock('@/lib/notifications|vi.mock('@twicely/notifications|g" "$f"
    sed -i "s|vi.mock('@/lib/storage|vi.mock('@twicely/storage|g" "$f"
    sed -i "s|vi.mock('@/lib/crosslister|vi.mock('@twicely/crosslister|g" "$f"
  done
done

echo ""
echo "=== Remaining @/lib/ in packages (should be zero): ==="
grep -r "from '@/lib/" packages/*/src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
echo "occurrences"

echo ""
echo "=== Remaining @/components/ in packages (should be zero): ==="
grep -r "from '@/components/" packages/*/src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
echo "occurrences"

echo ""
echo "=== Codemod Complete ==="
