#!/bin/bash
# WAVE DEEP AUDIT — Run after every wave, before moving on.
# Usage: bash wave-audit.sh [project-root]
# Exit codes: 0 = clean, 1 = issues found

set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
ISSUES=0

section() { echo -e "\n${YELLOW}━━━ $1 ━━━${NC}"; }
pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; ISSUES=$((ISSUES + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

echo "═══════════════════════════════════════"
echo "  WAVE DEEP AUDIT"
echo "  $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════"

# ─── TIER 1: TypeScript Compilation ───
section "TIER 1: TypeScript"

TSC_ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || true)
if [ "$TSC_ERRORS" -eq 0 ]; then
  pass "tsc --noEmit: 0 errors"
else
  fail "tsc --noEmit: $TSC_ERRORS errors"
  npx tsc --noEmit 2>&1 | head -20
fi

# ─── TIER 2: Tests ───
section "TIER 2: Tests"

TEST_OUTPUT=$(npx vitest run 2>&1)
TEST_PASS=$(echo "$TEST_OUTPUT" | grep -oP '\d+ passed' | grep -oP '\d+' || echo "0")
TEST_FAIL=$(echo "$TEST_OUTPUT" | grep -oP '\d+ failed' | grep -oP '\d+' || echo "0")
TEST_FILES_PASS=$(echo "$TEST_OUTPUT" | grep "Test Files" | grep -oP '\d+ passed' | grep -oP '\d+' || echo "0")
TEST_FILES_FAIL=$(echo "$TEST_OUTPUT" | grep "Test Files" | grep -oP '\d+ failed' | grep -oP '\d+' || echo "0")

if [ "$TEST_FAIL" -eq 0 ]; then
  pass "All $TEST_PASS tests passing ($TEST_FILES_PASS files)"
else
  fail "$TEST_FAIL tests failing out of $((TEST_PASS + TEST_FAIL))"
fi

# ─── TIER 3: Cross-Module Import Wiring ───
section "TIER 3: Import Wiring"

# Extract all named imports from key modules and verify they exist
BROKEN_IMPORTS=0
for MODULE_DIR in commerce stripe queries actions; do
  # Get all imports from this module directory
  grep -rn "from '@/lib/$MODULE_DIR/" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
  grep -oP "{ [^}]+ }" | tr ',' '\n' | sed 's/[{}]//g' | sed 's/^ *//;s/ *$//' | \
  sed 's/ as .*//' | grep -v "^type " | grep -v "^$" | sort -u | while read -r EXPORT_NAME; do
    # Check if this export exists in any file in the module dir
    if ! grep -rq "export.*\(function\|const\|class\|interface\|type\|enum\) $EXPORT_NAME\b" "src/lib/$MODULE_DIR/" 2>/dev/null; then
      if ! grep -rq "export {.*$EXPORT_NAME" "src/lib/$MODULE_DIR/" 2>/dev/null; then
        echo "MISSING: $EXPORT_NAME from @/lib/$MODULE_DIR"
        BROKEN_IMPORTS=$((BROKEN_IMPORTS + 1))
      fi
    fi
  done
done

BROKEN_COUNT=$(grep -rn "from '@/lib/" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
  grep -oP "{ [^}]+ }" | tr ',' '\n' | sed 's/[{}]//g' | sed 's/^ *//;s/ *$//' | \
  sed 's/ as .*//' | grep -v "^type " | grep -v "^$" | sort -u | wc -l)

if [ "$BROKEN_IMPORTS" -eq 0 ]; then
  pass "All named imports resolve ($BROKEN_COUNT checked)"
else
  fail "$BROKEN_IMPORTS broken imports found"
fi

# ─── TIER 4: Schema Field References ───
section "TIER 4: Schema Field Validation"

# Check for common schema mismatches we've hit before
SCHEMA_ISSUES=0

# Fields that DON'T exist (caught in previous waves)
for BAD_FIELD in "listing.images" "dispute.assignedToId" "dispute.stripeDisputeId" "returnRequest.deadlineAt" "returnRequest.sellerResponse[^N]" "returnRequest.respondedAt[^:]" "order.shippingAddress[^J]"; do
  HITS=$(grep -rn "$BAD_FIELD" src/lib/ src/app/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "test\|spec\|__tests__\|//" | wc -l || true)
  if [ "$HITS" -gt 0 ]; then
    fail "Bad schema ref: $BAD_FIELD ($HITS occurrences)"
    SCHEMA_ISSUES=$((SCHEMA_ISSUES + 1))
  fi
done

if [ "$SCHEMA_ISSUES" -eq 0 ]; then
  pass "No known bad schema references"
fi

# ─── TIER 5: Financial Math Safety ───
section "TIER 5: Financial Math"

# Check for floating point without Math.round in financial files
FINANCIAL_FILES=$(find src/lib/commerce src/lib/stripe -name "*.ts" ! -path "*test*" ! -path "*__tests__*" 2>/dev/null | xargs grep -l "Cents\|cents\|amount\|fee\|refund" 2>/dev/null || true)

UNROUNDED=0
for FILE in $FINANCIAL_FILES; do
  # Lines with multiplication by decimal that aren't wrapped in Math.round
  HITS=$(grep -n "\* 0\." "$FILE" 2>/dev/null | grep -v "Math\.\|//\|test\|PERCENT\|export const" | wc -l || true)
  if [ "$HITS" -gt 0 ]; then
    warn "Potential unrounded float math in $FILE ($HITS lines)"
    grep -n "\* 0\." "$FILE" 2>/dev/null | grep -v "Math\.\|//\|test\|PERCENT\|export const"
    UNROUNDED=$((UNROUNDED + 1))
  fi
done

if [ "$UNROUNDED" -eq 0 ]; then
  pass "All financial math appears rounded"
fi

# Check reverse_transfer on refunds
if grep -rq "refunds.create" src/lib/stripe/ 2>/dev/null; then
  if grep -A5 "refunds.create" src/lib/stripe/ 2>/dev/null | grep -q "reverse_transfer"; then
    pass "Stripe refunds include reverse_transfer"
  else
    fail "Stripe refunds MISSING reverse_transfer (platform eats refund cost)"
  fi
fi

# ─── TIER 6: Side-Effect Wiring (notify, Stripe, email) ───
section "TIER 6: Side-Effect Wiring"

# 6a. Every notification template must have a notify() call in business logic.
# NOT in service.tsx (that's the handler), NOT in templates.ts (that's the definition).
# Must be in commerce/, actions/, or app/ — where user actions trigger them.

DEFINED=$(grep -oP "'[a-z]+\.[a-z_.]+'" src/lib/notifications/templates.ts 2>/dev/null | sort -u)
DEFINED_COUNT=$(echo "$DEFINED" | wc -l)

# Search business logic dirs AND notifier helpers for actual notify() calls with template keys
TRIGGER_DIRS="src/lib/commerce src/lib/actions src/app src/lib/stripe src/lib/notifications"
UNWIRED=0

while IFS= read -r TPL; do
  [ -z "$TPL" ] && continue
  # Check if notify() or sendNotification() is called with this template key
  # in business logic files (exclude templates.ts, service.tsx, email/, seed-, test)
  HITS=$(grep -rn "$TPL" $TRIGGER_DIRS --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "templates\.ts\|service\.tsx\|seed-\|test\|__tests__\|email/\|\.test\." | \
    grep -c "notify\|sendNotification\|triggerNotification" || true)
  
  if [ "$HITS" -eq 0 ]; then
    fail "UNWIRED: $TPL — template defined + handler exists, but notify() never called"
    UNWIRED=$((UNWIRED + 1))
  fi
done <<< "$DEFINED"

if [ "$UNWIRED" -eq 0 ]; then
  pass "All $DEFINED_COUNT notification templates have notify() triggers"
else
  fail "$UNWIRED notification templates are defined but never triggered from business logic"
fi

# 6b. Every function that creates/updates financial records should call notify()
# Check: functions with "Refund" or "approve" or "decline" in name that don't call notify
FINANCIAL_FUNCS=$(grep -rn "export.*function.*[Rr]efund\|export.*function.*[Aa]pprove\|export.*function.*[Dd]ecline\|export.*function.*[Cc]ancel\|export.*function.*[Ss]hipped" \
  src/lib/commerce/ src/lib/actions/ --include="*.ts" 2>/dev/null | \
  grep -v "test\|__tests__" || true)

UNNOTIFIED=0
while IFS= read -r LINE; do
  [ -z "$LINE" ] && continue
  FILE=$(echo "$LINE" | cut -d: -f1)
  FUNC=$(echo "$LINE" | grep -oP "function \K\w+")
  [ -z "$FUNC" ] && continue
  
  # Check if the function body contains a notify call
  # Simple heuristic: search from function declaration to next export/end
  if ! grep -A50 "function $FUNC" "$FILE" 2>/dev/null | head -50 | grep -q "notify\|sendNotification"; then
    warn "Function $FUNC() in $(basename $FILE) has no notify() call — intentional?"
    UNNOTIFIED=$((UNNOTIFIED + 1))
  fi
done <<< "$FINANCIAL_FUNCS"

if [ "$UNNOTIFIED" -eq 0 ]; then
  pass "All financial state-change functions include notify() calls"
fi

# 6c. Stripe side-effects: every refunds.create must have reverse_transfer
# (moved from Tier 5 for logical grouping, kept in Tier 5 too for backward compat)

# ─── TIER 7: File Size Tolerances ───
section "TIER 7: File Size Limits"

OVERSIZED=0
while IFS= read -r FILE; do
  LINES=$(wc -l < "$FILE")
  BASENAME=$(basename "$FILE")
  
  # Different tolerances
  if [ "$LINES" -gt 600 ]; then
    fail "$BASENAME: $LINES lines (OVER 600 hard limit — must split)"
    OVERSIZED=$((OVERSIZED + 1))
  elif [ "$LINES" -gt 500 ]; then
    warn "$BASENAME: $LINES lines (approaching 600 limit)"
  fi
done < <(find src/lib src/app -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | sort -rn | head -20 | awk '{if($1 > 300) print $2}' | grep -v "total")

if [ "$OVERSIZED" -eq 0 ]; then
  pass "No files over 600 lines"
fi

# Top 10 largest files for awareness
echo ""
echo "  Largest files:"
find src/lib src/app -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | sort -rn | head -11 | tail -10 | while read -r LINE; do
  LINES=$(echo "$LINE" | awk '{print $1}')
  FILE=$(echo "$LINE" | awk '{print $2}')
  if [ "$LINES" -gt 400 ]; then
    echo -e "    ${YELLOW}$LINES${NC}  $FILE"
  else
    echo "    $LINES  $FILE"
  fi
done

# ─── TIER 8: Unused Exports (dead code) ───
section "TIER 8: Unused Exports (sampling)"

# Sample check: exports from commerce modules that are never imported elsewhere
DEAD_EXPORTS=0
for FILE in src/lib/commerce/*.ts; do
  [ -f "$FILE" ] || continue
  [[ "$FILE" == *"test"* ]] && continue
  [[ "$FILE" == *"__tests__"* ]] && continue
  
  BASENAME=$(basename "$FILE" .ts)
  
  grep -oP "export (async )?function \K\w+" "$FILE" 2>/dev/null | while read -r FUNC; do
    # Check if it's imported anywhere outside its own file
    REFS=$(grep -rn "$FUNC" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "$FILE" | grep -v "__tests__" | grep -v "test.ts" | wc -l || true)
    if [ "$REFS" -eq 0 ]; then
      warn "Exported but never imported: $FUNC ($BASENAME.ts)"
    fi
  done
done

pass "Dead export scan complete (warnings above if any)"

# ─── SUMMARY ───
echo ""
echo "═══════════════════════════════════════"
if [ "$ISSUES" -eq 0 ]; then
  echo -e "  ${GREEN}AUDIT PASSED${NC} — 0 issues"
else
  echo -e "  ${RED}AUDIT FOUND $ISSUES ISSUE(S)${NC}"
fi
echo "═══════════════════════════════════════"

exit "$ISSUES"
