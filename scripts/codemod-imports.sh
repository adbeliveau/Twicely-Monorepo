#!/bin/bash
# Codemod script: Rewrite @/lib/* imports to @twicely/* package imports
# Run from the monorepo root: bash scripts/codemod-imports.sh
#
# This rewrites imports in apps/web/src/ to use package names.
# Package source files (packages/*/src/) use relative imports within
# their own package and @twicely/* imports for cross-package deps.

set -euo pipefail

TARGET="apps/web/src"

echo "=== Twicely Import Codemod ==="
echo "Target: $TARGET"

# Map @/lib/* paths to @twicely/* package names
# Order matters — more specific patterns first

declare -a PATTERNS=(
  # DB
  "s|from '@/lib/db/schema/enums'|from '@twicely/db/schema'|g"
  "s|from '@/lib/db/schema'|from '@twicely/db/schema'|g"
  "s|from '@/lib/db'|from '@twicely/db'|g"

  # Auth
  "s|from '@/lib/auth/server'|from '@twicely/auth/server'|g"
  "s|from '@/lib/auth/staff-auth'|from '@twicely/auth/staff-auth'|g"
  "s|from '@/lib/auth/impersonation'|from '@twicely/auth/impersonation'|g"
  "s|from '@/lib/auth/client'|from '@twicely/auth/client'|g"
  "s|from '@/lib/auth'|from '@twicely/auth'|g"

  # CASL
  "s|from '@/lib/casl/staff-authorize'|from '@twicely/casl/staff-authorize'|g"
  "s|from '@/lib/casl/authorize'|from '@twicely/casl/authorize'|g"
  "s|from '@/lib/casl/ability'|from '@twicely/casl/ability'|g"
  "s|from '@/lib/casl/types'|from '@twicely/casl/types'|g"
  "s|from '@/lib/casl/subjects'|from '@twicely/casl/subjects'|g"
  "s|from '@/lib/casl/check'|from '@twicely/casl/check'|g"
  "s|from '@/lib/casl'|from '@twicely/casl'|g"

  # Commerce
  "s|from '@/lib/commerce/\([^']*\)'|from '@twicely/commerce/\1'|g"

  # Crosslister
  "s|from '@/lib/crosslister/\([^']*\)'|from '@twicely/crosslister/\1'|g"

  # Stripe
  "s|from '@/lib/stripe/\([^']*\)'|from '@twicely/stripe/\1'|g"

  # Email
  "s|from '@/lib/email/\([^']*\)'|from '@twicely/email/\1'|g"

  # Notifications
  "s|from '@/lib/notifications/\([^']*\)'|from '@twicely/notifications/\1'|g"

  # Storage
  "s|from '@/lib/storage/\([^']*\)'|from '@twicely/storage/\1'|g"

  # Realtime
  "s|from '@/lib/realtime/\([^']*\)'|from '@twicely/realtime/\1'|g"

  # Jobs
  "s|from '@/lib/jobs/\([^']*\)'|from '@twicely/jobs/\1'|g"

  # Subscriptions
  "s|from '@/lib/subscriptions/\([^']*\)'|from '@twicely/subscriptions/\1'|g"

  # Finance
  "s|from '@/lib/finance/\([^']*\)'|from '@twicely/finance/\1'|g"

  # Search
  "s|from '@/lib/search/\([^']*\)'|from '@twicely/search/\1'|g"

  # Scoring (subset of commerce that was extracted)
  "s|from '@twicely/commerce/calculate-seller-score'|from '@twicely/scoring/calculate-seller-score'|g"
  "s|from '@twicely/commerce/performance-band'|from '@twicely/scoring/performance-band'|g"

  # Logger
  "s|from '@/lib/logger'|from '@twicely/logger'|g"

  # Utils
  "s|from '@/lib/utils/cn'|from '@twicely/utils/cn'|g"
  "s|from '@/lib/utils/format'|from '@twicely/utils/format'|g"
  "s|from '@/lib/utils'|from '@twicely/utils'|g"

  # UI components
  "s|from '@/components/ui/\([^']*\)'|from '@twicely/ui/\1'|g"

  # Cache/Valkey
  "s|from '@/lib/cache/valkey'|from '@twicely/db/cache'|g"

  # Queries (stay in web app — just normalize path)
  "s|from '@/lib/queries/platform-settings'|from '@twicely/db/queries/platform-settings'|g"

  # Encryption
  "s|from '@/lib/encryption'|from '@twicely/db/encryption'|g"

  # Config
  "s|from '@/lib/config/\([^']*\)'|from '@twicely/config/\1'|g"
)

# Also handle vi.mock patterns in test files
declare -a MOCK_PATTERNS=(
  "s|vi.mock('@/lib/db|vi.mock('@twicely/db|g"
  "s|vi.mock('@/lib/casl|vi.mock('@twicely/casl|g"
  "s|vi.mock('@/lib/auth|vi.mock('@twicely/auth|g"
  "s|vi.mock('@/lib/commerce|vi.mock('@twicely/commerce|g"
  "s|vi.mock('@/lib/crosslister|vi.mock('@twicely/crosslister|g"
  "s|vi.mock('@/lib/stripe|vi.mock('@twicely/stripe|g"
  "s|vi.mock('@/lib/email|vi.mock('@twicely/email|g"
  "s|vi.mock('@/lib/notifications|vi.mock('@twicely/notifications|g"
  "s|vi.mock('@/lib/storage|vi.mock('@twicely/storage|g"
  "s|vi.mock('@/lib/realtime|vi.mock('@twicely/realtime|g"
  "s|vi.mock('@/lib/jobs|vi.mock('@twicely/jobs|g"
  "s|vi.mock('@/lib/subscriptions|vi.mock('@twicely/subscriptions|g"
  "s|vi.mock('@/lib/finance|vi.mock('@twicely/finance|g"
  "s|vi.mock('@/lib/search|vi.mock('@twicely/search|g"
  "s|vi.mock('@/lib/logger|vi.mock('@twicely/logger|g"
  "s|vi.mock('@/lib/utils|vi.mock('@twicely/utils|g"
  "s|vi.mock('@/lib/cache/valkey|vi.mock('@twicely/db/cache|g"
  "s|vi.mock('@/components/ui|vi.mock('@twicely/ui|g"
)

# Count files to process
FILE_COUNT=$(find "$TARGET" -name "*.ts" -o -name "*.tsx" | wc -l)
echo "Files to process: $FILE_COUNT"

# Apply import rewrites
CHANGED=0
for pattern in "${PATTERNS[@]}"; do
  count=$(grep -rl "$(echo "$pattern" | sed 's/s|\(.*\)|\(.*\)|g/\1/' | sed "s/\\\\\([^(]*\)/\1/g")" "$TARGET" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    find "$TARGET" -name "*.ts" -o -name "*.tsx" | xargs sed -i "$pattern" 2>/dev/null
    CHANGED=$((CHANGED + count))
  fi
done

# Apply mock pattern rewrites
for pattern in "${MOCK_PATTERNS[@]}"; do
  find "$TARGET" -name "*.test.ts" -o -name "*.test.tsx" | xargs sed -i "$pattern" 2>/dev/null
done

echo "=== Codemod Complete ==="
echo "Import rewrites applied to approximately $CHANGED file groups"
echo ""
echo "Remaining @/lib/ imports (should be actions, queries, mutations — app-local):"
grep -r "from '@/lib/" "$TARGET" --include="*.ts" --include="*.tsx" -l 2>/dev/null | wc -l
echo "files still use @/lib/ (expected — these are app-local imports)"
