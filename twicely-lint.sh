#!/bin/bash
# twicely-lint.sh — Twicely V3 Compliance Linter
# Run after every Claude Code session. Paste FULL output in report.
# 
# This script reads BASELINE_TESTS from CLAUDE.md automatically.
# After a successful pass, update the BASELINE_TESTS number in CLAUDE.md.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

FAILURES=0

# ── Read baseline from CLAUDE.md ─────────────────────────────────────
CLAUDE_MD="./CLAUDE.md"
if [ ! -f "$CLAUDE_MD" ]; then
  echo -e "${RED}❌ CLAUDE.md not found in repo root${NC}"
  exit 1
fi

BASELINE_TESTS=$(grep 'BASELINE_TESTS=' "$CLAUDE_MD" | head -1 | sed 's/BASELINE_TESTS=//')
if [ -z "$BASELINE_TESTS" ]; then
  echo -e "${RED}❌ Could not read BASELINE_TESTS from CLAUDE.md${NC}"
  exit 1
fi

echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  TWICELY V3 COMPLIANCE LINTER                               ${NC}"
echo -e "${BOLD}  Baseline: ${BASELINE_TESTS} tests | 0 TS errors              ${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ── 1. TypeScript ────────────────────────────────────────────────────
echo -e "${BOLD}[1/7] TypeScript Check${NC}"
echo "────────────────────────────────────────"
TS_OUTPUT=$(npx turbo typecheck --force 2>&1) || true
TS_ERRORS=$(echo "$TS_OUTPUT" | grep -c "error TS" || true)

if [ "$TS_ERRORS" -eq 0 ]; then
  echo -e "${GREEN}✅ TypeScript: 0 errors${NC}"
else
  echo -e "${RED}❌ TypeScript: ${TS_ERRORS} errors${NC}"
  echo "$TS_OUTPUT" | grep "error TS" | head -20
  FAILURES=$((FAILURES + 1))
fi
echo ""

# ── 2. Test Count ────────────────────────────────────────────────────
echo -e "${BOLD}[2/7] Test Count${NC}"
echo "────────────────────────────────────────"
TEST_OUTPUT=$(npx turbo test --force --concurrency=1 2>&1) || true

# Strip ANSI escape codes for reliable parsing
CLEAN_OUTPUT=$(echo "$TEST_OUTPUT" | sed 's/\x1b\[[0-9;]*m//g' | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g')

# Parse total from "(NNN)" at end of ALL Tests summary lines and sum them (turbo runs multiple packages)
TEST_COUNT=$(echo "$CLEAN_OUTPUT" | grep -E '^\s*Tests\s' | grep -oE '\([0-9]+\)' | grep -o '[0-9]*' | awk '{s+=$1} END {print s}' || true)
# Fallback: sum all "N passed" values if total not found
if [ -z "$TEST_COUNT" ] || [ "$TEST_COUNT" = "0" ]; then
  TEST_COUNT=$(echo "$CLEAN_OUTPUT" | grep -oE '[0-9]+ passed' | grep -o '[0-9]*' | awk '{s+=$1} END {print s}' || true)
fi
TEST_FAILED=$(echo "$CLEAN_OUTPUT" | grep -oE '[0-9]+ failed' | grep -o '[0-9]*' | awk '{s+=$1} END {print s}' || true)
if [ -z "$TEST_FAILED" ]; then
  TEST_FAILED=0
fi

if [ -z "$TEST_COUNT" ]; then
  echo -e "${YELLOW}⚠️  Could not parse test count from output${NC}"
  echo "Raw output (last 10 lines):"
  echo "$TEST_OUTPUT" | tail -10
  FAILURES=$((FAILURES + 1))
elif [ "$TEST_COUNT" -lt "$BASELINE_TESTS" ]; then
  echo -e "${RED}❌ Tests: ${TEST_COUNT} passing (baseline: ${BASELINE_TESTS}) — DECREASED BY $((BASELINE_TESTS - TEST_COUNT))${NC}"
  FAILURES=$((FAILURES + 1))
else
  echo -e "${GREEN}✅ Tests: ${TEST_COUNT} passing (baseline: ${BASELINE_TESTS})${NC}"
  if [ "$TEST_COUNT" -gt "$BASELINE_TESTS" ]; then
    echo -e "${YELLOW}   ℹ️  New tests added: +$((TEST_COUNT - BASELINE_TESTS)). Update BASELINE_TESTS in CLAUDE.md to ${TEST_COUNT}${NC}"
  fi
fi

if [ "$TEST_FAILED" -gt 0 ]; then
  echo -e "${RED}❌ ${TEST_FAILED} tests FAILED${NC}"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# ── 3. Banned Terms ──────────────────────────────────────────────────
echo -e "${BOLD}[3/7] Banned Terms${NC}"
echo "────────────────────────────────────────"
BANNED_PATTERNS=(
  "SellerTier"
  "SubscriptionTier"
  "FVF"
  "Final Value Fee"
  "as any"
  "@ts-ignore"
  "@ts-expect-error"
  "Twicely Balance"
  "Twicely wallet"
  "StoreTier.BASIC"
  "StoreTier.ELITE"
  "ListerTier.PLUS"
  "ListerTier.MAX"
  "ListerTier.POWER"
  "ListerTier.ENTERPRISE"
  "PerformanceBand.STANDARD"
  "PerformanceBand.RISING"
)

BANNED_FOUND=0
for pattern in "${BANNED_PATTERNS[@]}"; do
  MATCHES=$(grep -rn "$pattern" apps/web/src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    COUNT=$(echo "$MATCHES" | wc -l)
    echo -e "${RED}❌ \"${pattern}\" — ${COUNT} occurrence(s):${NC}"
    echo "$MATCHES" | head -5
    if [ "$COUNT" -gt 5 ]; then
      echo "   ... and $((COUNT - 5)) more"
    fi
    BANNED_FOUND=$((BANNED_FOUND + 1))
  fi
done

if [ "$BANNED_FOUND" -eq 0 ]; then
  echo -e "${GREEN}✅ No banned terms found${NC}"
else
  echo -e "${RED}❌ ${BANNED_FOUND} banned term(s) found${NC}"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# ── 4. Wrong Route Prefixes ─────────────────────────────────────────
echo -e "${BOLD}[4/7] Route Prefix Check${NC}"
echo "────────────────────────────────────────"
WRONG_ROUTES=(
  '"/l/'
  '"/listing/'
  '"/listings/'
  '"/store/'
  '"/shop/'
  '"/dashboard"'
  '"/admin"'
  '"/settings"'
)

ROUTE_FOUND=0
for pattern in "${WRONG_ROUTES[@]}"; do
  MATCHES=$(grep -rn "$pattern" apps/web/src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    COUNT=$(echo "$MATCHES" | wc -l)
    echo -e "${RED}❌ Wrong route ${pattern} — ${COUNT} occurrence(s):${NC}"
    echo "$MATCHES" | head -5
    ROUTE_FOUND=$((ROUTE_FOUND + 1))
  fi
done

if [ "$ROUTE_FOUND" -eq 0 ]; then
  echo -e "${GREEN}✅ No wrong route prefixes found${NC}"
else
  echo -e "${RED}❌ ${ROUTE_FOUND} wrong route pattern(s) found${NC}"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# ── 5. File Size Check ───────────────────────────────────────────────
echo -e "${BOLD}[5/7] File Size Check (300 line max)${NC}"
echo "────────────────────────────────────────"
OVERSIZED=$(find apps/web/src -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v "__tests__\|\.test\.\|\.spec\." | xargs wc -l 2>/dev/null | awk '$1 > 300 && !/total$/ {print $0}' | sort -rn || true)

if [ -z "$OVERSIZED" ]; then
  echo -e "${GREEN}✅ All files under 300 lines${NC}"
else
  OVERCOUNT=$(echo "$OVERSIZED" | wc -l)
  echo -e "${RED}❌ ${OVERCOUNT} file(s) over 300 lines:${NC}"
  echo "$OVERSIZED"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# ── 6. Payout UX Language ───────────────────────────────────────────
echo -e "${BOLD}[6/7] Payout UX Language Check${NC}"
echo "────────────────────────────────────────"
UX_PATTERNS=(
  '"Withdraw"'
  '"Your balance"'
  '"Sale price"'
  '"Net payout"'
  '"Stripe fee"'
  '"Commission"'
  '"Withdrawal initiated"'
  '"Funds deposited"'
  '"Balance updated"'
)

UX_FOUND=0
for pattern in "${UX_PATTERNS[@]}"; do
  MATCHES=$(grep -rn "$pattern" apps/web/src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    COUNT=$(echo "$MATCHES" | wc -l)
    echo -e "${RED}❌ Banned UX term ${pattern} — ${COUNT} occurrence(s):${NC}"
    echo "$MATCHES" | head -3
    UX_FOUND=$((UX_FOUND + 1))
  fi
done

if [ "$UX_FOUND" -eq 0 ]; then
  echo -e "${GREEN}✅ No banned UX language found${NC}"
else
  echo -e "${RED}❌ ${UX_FOUND} banned UX term(s) found${NC}"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# ── 7. console.log in Production ─────────────────────────────────────
echo -e "${BOLD}[7/7] console.log Check${NC}"
echo "────────────────────────────────────────"
CONSOLE_MATCHES=$(grep -rn "console\.log(" apps/web/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
  grep -v "__tests__\|\.test\.\|test-\|seed\|seed-\|mock\|\.spec\.\|//.*console\|logger\.ts" || true)

if [ -z "$CONSOLE_MATCHES" ]; then
  echo -e "${GREEN}✅ No console.log in production code${NC}"
else
  CONSOLE_COUNT=$(echo "$CONSOLE_MATCHES" | wc -l)
  echo -e "${RED}❌ console.log in production code — ${CONSOLE_COUNT} occurrence(s):${NC}"
  echo "$CONSOLE_MATCHES" | head -10
  if [ "$CONSOLE_COUNT" -gt 10 ]; then
    echo "   ... and $((CONSOLE_COUNT - 10)) more"
  fi
  FAILURES=$((FAILURES + 1))
fi
echo ""

# ── Summary ──────────────────────────────────────────────────────────
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  ✅ ALL CHECKS PASSED${NC}"
  if [ -n "$TEST_COUNT" ] && [ "$TEST_COUNT" -gt "$BASELINE_TESTS" ]; then
    echo -e "${YELLOW}  ℹ️  Update CLAUDE.md: BASELINE_TESTS=${TEST_COUNT}${NC}"
  fi
else
  echo -e "${RED}${BOLD}  ❌ ${FAILURES} CHECK(S) FAILED — STOP AND REPORT TO OWNER${NC}"
  echo -e "${RED}  Do NOT attempt to fix failures yourself.${NC}"
  echo -e "${RED}  Paste this FULL output and ask how to proceed.${NC}"
fi
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

exit $FAILURES
