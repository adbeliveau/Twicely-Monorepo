#!/bin/bash
# twicely-audit.sh — Unified Shell Audit for Super Audit V2
# Covers Streams 5 (money), 7 (wiring), 8 (stripe), 9 (hygiene), 11 (runtime)
#
# Usage:
#   bash twicely-audit.sh              # Run all shell streams
#   bash twicely-audit.sh money        # Stream 5 only
#   bash twicely-audit.sh wiring       # Stream 7 only
#   bash twicely-audit.sh stripe       # Stream 8 only
#   bash twicely-audit.sh hygiene      # Stream 9 only
#   bash twicely-audit.sh runtime      # Stream 11 only
#   bash twicely-audit.sh smoke        # Stream 10a only
#   bash twicely-audit.sh quick        # All 6 shell streams
#
# Exit codes: 0 = clean, non-zero = issue count

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo '.')/apps/web"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

BLOCKERS=0
WARNINGS=0
INFOS=0

blocker() { echo -e "  ${RED}[BLOCKER]${NC} $1"; BLOCKERS=$((BLOCKERS + 1)); }
warning() { echo -e "  ${YELLOW}[WARNING]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
info()    { echo -e "  ${CYAN}[INFO]${NC} $1"; INFOS=$((INFOS + 1)); }
pass()    { echo -e "  ${GREEN}[PASS]${NC} $1"; }
section() { echo -e "\n${BOLD}${CYAN}--- STREAM $1 ---${NC}"; }

STREAM="${1:-all}"

echo -e "${BOLD}=======================================${NC}"
echo -e "${BOLD}  TWICELY AUDIT V2 — Shell Streams${NC}"
echo -e "${BOLD}  $(date '+%Y-%m-%d %H:%M')${NC}"
echo -e "${BOLD}  Mode: ${STREAM}${NC}"
echo -e "${BOLD}=======================================${NC}"

# =====================================================================
# STREAM 5: Money Math & Banned Terms
# =====================================================================
run_money() {
  section "5: Money Math & Banned Terms"

  # --- 5a. Banned terms (same as twicely-lint.sh) ---
  echo -e "\n  ${BOLD}Banned Terms:${NC}"
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

  BANNED_TOTAL=0
  for pattern in "${BANNED_PATTERNS[@]}"; do
    COUNT=$(grep -rn "$pattern" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || true)
    if [ "$COUNT" -gt 0 ]; then
      blocker "Banned term \"${pattern}\" — ${COUNT} occurrence(s)"
      grep -rn "$pattern" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -3
      BANNED_TOTAL=$((BANNED_TOTAL + COUNT))
    fi
  done
  if [ "$BANNED_TOTAL" -eq 0 ]; then
    pass "No banned terms found"
  fi

  # --- 5b. UX Language ---
  echo -e "\n  ${BOLD}Payout UX Language:${NC}"
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

  UX_TOTAL=0
  for pattern in "${UX_PATTERNS[@]}"; do
    COUNT=$(grep -rn "$pattern" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || true)
    if [ "$COUNT" -gt 0 ]; then
      blocker "Banned UX term ${pattern} — ${COUNT} occurrence(s)"
      grep -rn "$pattern" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -3
      UX_TOTAL=$((UX_TOTAL + COUNT))
    fi
  done
  if [ "$UX_TOTAL" -eq 0 ]; then
    pass "No banned UX language found"
  fi

  # --- 5c. Wrong route prefixes ---
  echo -e "\n  ${BOLD}Wrong Route Prefixes:${NC}"
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

  ROUTE_TOTAL=0
  for pattern in "${WRONG_ROUTES[@]}"; do
    COUNT=$(grep -rn "$pattern" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || true)
    if [ "$COUNT" -gt 0 ]; then
      blocker "Wrong route ${pattern} — ${COUNT} occurrence(s)"
      grep -rn "$pattern" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -3
      ROUTE_TOTAL=$((ROUTE_TOTAL + COUNT))
    fi
  done
  if [ "$ROUTE_TOTAL" -eq 0 ]; then
    pass "No wrong route prefixes"
  fi

  # --- 5d. Float money math ---
  echo -e "\n  ${BOLD}Float Money Math:${NC}"
  FINANCIAL_FILES=$(find src/lib/commerce src/lib/stripe src/lib/actions -name "*.ts" ! -path "*test*" ! -path "*__tests__*" 2>/dev/null || true)

  FLOAT_ISSUES=0
  for FILE in $FINANCIAL_FILES; do
    HITS=$(grep -n "\* 0\.\|parseFloat.*[Cc]ents\|toFixed.*[Cc]ents" "$FILE" 2>/dev/null | grep -v "Math\.\|//\|test\|PERCENT\|export const\|BPS" | wc -l || true)
    if [ "$HITS" -gt 0 ]; then
      blocker "Potential float money math in $(basename $FILE) ($HITS lines)"
      grep -n "\* 0\.\|parseFloat.*[Cc]ents\|toFixed.*[Cc]ents" "$FILE" 2>/dev/null | grep -v "Math\.\|//\|test\|PERCENT\|export const\|BPS" | head -3
      FLOAT_ISSUES=$((FLOAT_ISSUES + 1))
    fi
  done
  if [ "$FLOAT_ISSUES" -eq 0 ]; then
    pass "No float money math detected"
  fi

  # --- 5e. Fee calculations in client components ---
  echo -e "\n  ${BOLD}Client-Side Fee Calculations:${NC}"
  CLIENT_FEE=0
  CLIENT_FILES=$(grep -rln "'use client'" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
  for FILE in $CLIENT_FILES; do
    HITS=$(grep -n "tfRate\|tfAmount\|calculateTf\|transactionFee\|feePercent\|feeCents" "$FILE" 2>/dev/null | grep -v "//\|display\|format\|label\|column\|header" | wc -l || true)
    if [ "$HITS" -gt 0 ]; then
      blocker "Fee calculation in client component: $(basename $FILE) ($HITS lines)"
      grep -n "tfRate\|tfAmount\|calculateTf\|transactionFee\|feePercent\|feeCents" "$FILE" 2>/dev/null | grep -v "//\|display\|format\|label\|column\|header" | head -3
      CLIENT_FEE=$((CLIENT_FEE + 1))
    fi
  done
  if [ "$CLIENT_FEE" -eq 0 ]; then
    pass "No fee calculations in client components"
  fi
}

# =====================================================================
# STREAM 7: Wiring & Side Effects
# =====================================================================
run_wiring() {
  section "7: Wiring & Side Effects"

  # --- 7a. Notification template wiring ---
  echo -e "\n  ${BOLD}Notification Template Wiring:${NC}"
  TEMPLATES=$(grep -oE "'[a-z]+\.[a-z_.]+'" src/lib/notifications/templates.ts 2>/dev/null | sort -u || true)
  TEMPLATE_COUNT=$(echo "$TEMPLATES" | grep -c . || true)

  if [ "$TEMPLATE_COUNT" -eq 0 ]; then
    info "No notification templates found (templates.ts missing?)"
  else
    UNWIRED=0
    while IFS= read -r TPL; do
      [ -z "$TPL" ] && continue
      HITS=$(grep -rn "$TPL" src/lib/commerce src/lib/actions src/app src/lib/stripe src/lib/notifications \
        --include="*.ts" --include="*.tsx" 2>/dev/null | \
        grep -v "templates\.ts\|service\.tsx\|seed-\|test\|__tests__\|email/" | \
        grep -c "notify\|sendNotification\|triggerNotification" || true)
      if [ "$HITS" -eq 0 ]; then
        warning "Unwired template: $TPL — defined but notify() never called from business logic"
        UNWIRED=$((UNWIRED + 1))
      fi
    done <<< "$TEMPLATES"
    if [ "$UNWIRED" -eq 0 ]; then
      pass "All $TEMPLATE_COUNT notification templates have notify() triggers"
    fi
  fi

  # --- 7b. State-change functions missing notify() ---
  echo -e "\n  ${BOLD}State-Change Side Effects:${NC}"
  SIDE_EFFECT_FUNCS=(
    "createReturnRequest:returns.ts"
    "approveReturn:returns.ts"
    "declineReturn:returns.ts"
    "markReturnShipped:returns.ts"
    "processReturnRefund:returns.ts"
    "escalateToDispute:disputes.ts"
    "resolveDispute:disputes.ts"
    "createProtectionClaim:buyer-protection.ts"
    "processProtectionClaim:buyer-protection.ts"
    "markOrderShipped:shipping.ts"
    "cancelOrder:shipping.ts"
    "markOrderDelivered:shipping.ts"
    "createOffer:offer-engine.ts"
    "acceptOffer:offer-engine.ts"
    "declineOffer:offer-engine.ts"
    "counterOffer:offer-engine.ts"
  )

  MISSING_NOTIFY=0
  for ENTRY in "${SIDE_EFFECT_FUNCS[@]}"; do
    FUNC=$(echo "$ENTRY" | cut -d: -f1)
    FILE_HINT=$(echo "$ENTRY" | cut -d: -f2)
    FOUND_FILE=$(find src/lib -name "$FILE_HINT" ! -path "*test*" ! -path "*__tests__*" 2>/dev/null | head -1)
    [ -z "$FOUND_FILE" ] && continue
    if ! grep -q "function $FUNC\b" "$FOUND_FILE" 2>/dev/null; then
      continue
    fi
    HAS_NOTIFY=$(grep -A80 "function $FUNC\b" "$FOUND_FILE" 2>/dev/null | head -80 | grep -c "notify\|sendNotification" || true)
    if [ "$HAS_NOTIFY" -eq 0 ]; then
      warning "$FUNC() in $FILE_HINT — no notify() call"
      MISSING_NOTIFY=$((MISSING_NOTIFY + 1))
    fi
  done
  if [ "$MISSING_NOTIFY" -eq 0 ]; then
    pass "All state-change functions have notify() calls"
  fi

  # --- 7c. Dead exports (exported but never imported) ---
  # Strategy: build a single index of all imported and re-exported symbols
  # from ANY source (relative paths, @/lib/*, @twicely/*) once, then check each
  # export against that index. Uses perl to handle multi-line import blocks.
  echo -e "\n  ${BOLD}Dead Exports (commerce/stripe/queries):${NC}"
  set +e
  set +o pipefail
  DEAD_COUNT=0
  IMPORTED_INDEX=$(mktemp)
  trap 'rm -f "$IMPORTED_INDEX"' EXIT

  # Use perl in slurp mode (-0777) to handle multi-line `import { ... }` and
  # `export { ... } from` blocks. We extract every symbol name between { and }.
  find src/ ../../packages/ -type f \( -name "*.ts" -o -name "*.tsx" \) \
    -not -path "*/__tests__/*" -not -path "*/node_modules/*" \
    -not -name "*.test.ts" -not -name "*.test.tsx" 2>/dev/null \
    | xargs perl -0777 -ne '
        while (/(?:^|[\s;])(?:import|export)\s*(?:type\s+)?\{([^}]+)\}/g) {
          my $block = $1;
          $block =~ s/\/\*.*?\*\///gs;
          $block =~ s/\/\/[^\n]*//g;
          for my $name (split /,/, $block) {
            $name =~ s/^\s+|\s+$//g;
            $name =~ s/^type\s+//;
            $name =~ s/\s+as\s+.*//;
            print "$name\n" if $name =~ /^[a-zA-Z_][a-zA-Z0-9_]*$/;
          }
        }
      ' 2>/dev/null \
    | sort -u > "$IMPORTED_INDEX"

  for DIR in src/lib/commerce src/lib/stripe src/lib/queries; do
    [ -d "$DIR" ] || continue
    for FILE in "$DIR"/*.ts; do
      [ -f "$FILE" ] || continue
      [[ "$FILE" == *"test"* || "$FILE" == *"__tests__"* || "$FILE" == *"index"* ]] && continue
      BASEFILE=$(basename "$FILE")
      FUNCS=$(grep -oE "export (async )?function [a-zA-Z_][a-zA-Z0-9_]*" "$FILE" 2>/dev/null \
        | sed 's/export //; s/async //; s/function //' || true)
      [ -z "$FUNCS" ] && continue
      while IFS= read -r FUNC; do
        [ -z "$FUNC" ] && continue
        # If symbol is imported or re-exported anywhere → not dead
        if grep -qx "$FUNC" "$IMPORTED_INDEX"; then continue; fi
        warning "Dead export: $FUNC() in $BASEFILE"
        DEAD_COUNT=$((DEAD_COUNT + 1))
      done <<< "$FUNCS"
    done
  done
  rm -f "$IMPORTED_INDEX"
  trap - EXIT
  if [ "$DEAD_COUNT" -eq 0 ]; then
    pass "No dead exports found"
  fi
  set -e
  set -o pipefail

  # --- 7d. Broken imports (named imports that don't resolve) ---
  echo -e "\n  ${BOLD}Broken Imports:${NC}"
  set +e
  set +o pipefail
  BROKEN=0
  # NOTE: We avoid `grep -P` here because Windows Git Bash builds of grep
  # only support -P with unibyte/UTF-8 locales and crash otherwise.
  # Use awk + sed instead for portable parsing.
  for MODULE_DIR in commerce stripe queries actions; do
    [ -d "src/lib/$MODULE_DIR" ] || continue
    IMPORT_LINES=$(grep -rh "from '@/lib/$MODULE_DIR/" src/ --include="*.ts" --include="*.tsx" 2>/dev/null \
      | grep "import {" || true)
    [ -z "$IMPORT_LINES" ] && continue
    # Extract symbols between { and }
    EXPORT_NAMES=$(echo "$IMPORT_LINES" \
      | sed -n 's/.*import[[:space:]]*{\([^}]*\)}.*/\1/p' \
      | tr ',' '\n' \
      | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
      | sed 's/[[:space:]]*as[[:space:]].*//' \
      | grep -v "^type " \
      | grep -v "^$" \
      | sort -u)
    [ -z "$EXPORT_NAMES" ] && continue
    while IFS= read -r EXPORT_NAME; do
      [ -z "$EXPORT_NAME" ] && continue
      if ! grep -rq "export.*\(function\|const\|class\|interface\|type\|enum\)[[:space:]]*$EXPORT_NAME\b" "src/lib/$MODULE_DIR/" 2>/dev/null; then
        if ! grep -rq "export {.*$EXPORT_NAME" "src/lib/$MODULE_DIR/" 2>/dev/null; then
          warning "Broken import: $EXPORT_NAME from @/lib/$MODULE_DIR"
          BROKEN=$((BROKEN + 1))
        fi
      fi
    done <<< "$EXPORT_NAMES"
  done
  if [ "$BROKEN" -eq 0 ]; then
    pass "All named imports resolve"
  fi
  set -e
  set -o pipefail
}

# =====================================================================
# STREAM 8: Stripe & Payments
# =====================================================================
run_stripe() {
  section "8: Stripe & Payments"

  # --- 8a. Refund safety ---
  echo -e "\n  ${BOLD}Stripe Refund Safety:${NC}"
  REFUND_FILES=$(grep -rln "refunds.create" src/lib/stripe/ 2>/dev/null || true)
  if [ -z "$REFUND_FILES" ]; then
    info "No refunds.create calls found in src/lib/stripe/"
  else
    for RF in $REFUND_FILES; do
      if grep -A10 "refunds.create" "$RF" 2>/dev/null | grep -q "reverse_transfer"; then
        pass "$(basename $RF) — refunds.create has reverse_transfer"
      else
        blocker "$(basename $RF) — refunds.create MISSING reverse_transfer"
      fi
      if grep -A10 "refunds.create" "$RF" 2>/dev/null | grep -q "refund_application_fee"; then
        pass "$(basename $RF) — refunds.create has refund_application_fee"
      else
        blocker "$(basename $RF) — refunds.create MISSING refund_application_fee"
      fi
    done
  fi

  # --- 8b. PaymentIntent destination charges ---
  echo -e "\n  ${BOLD}PaymentIntent Destination Charges:${NC}"
  PI_FILES=$(grep -rln "paymentIntents.create" src/lib/stripe/ src/lib/actions/ 2>/dev/null || true)
  if [ -z "$PI_FILES" ]; then
    info "No paymentIntents.create calls found"
  else
    for PF in $PI_FILES; do
      if grep -q "transfer_data\|destination" "$PF" 2>/dev/null; then
        pass "$(basename $PF) — PaymentIntent uses destination charges"
      else
        warning "$(basename $PF) — PaymentIntent.create without transfer_data"
      fi
    done
  fi

  # --- 8c. Checkout seller onboarding check ---
  echo -e "\n  ${BOLD}Checkout Seller Onboarding Gate:${NC}"
  CHECKOUT_FILE="src/lib/actions/checkout.ts"
  if [ -f "$CHECKOUT_FILE" ]; then
    ONBOARD=$(grep -c "stripeOnboarded\|payoutsEnabled\|isSellerPaymentReady\|stripeAccountId" "$CHECKOUT_FILE" 2>/dev/null || true)
    if [ "$ONBOARD" -gt 0 ]; then
      pass "Checkout verifies seller onboarding ($ONBOARD checks)"
    else
      blocker "Checkout does NOT verify seller is onboarded before PaymentIntent"
    fi
  else
    info "checkout.ts not found"
  fi

  # --- 8d. MIN_ORDER_CENTS ---
  echo -e "\n  ${BOLD}Minimum Order Enforcement:${NC}"
  if [ -f "$CHECKOUT_FILE" ]; then
    MIN_ORDER=$(grep -c "MIN_ORDER_CENTS\|minimumOrder\|minOrderCents" "$CHECKOUT_FILE" 2>/dev/null || true)
    if [ "$MIN_ORDER" -gt 0 ]; then
      pass "MIN_ORDER_CENTS enforced in checkout"
    else
      warning "MIN_ORDER_CENTS not found in checkout"
    fi
  fi

  # --- 8e. Webhook handler completeness ---
  echo -e "\n  ${BOLD}Webhook Event Coverage:${NC}"
  WEBHOOK_FILE="src/lib/stripe/webhooks.ts"
  if [ -f "$WEBHOOK_FILE" ]; then
    EVENTS=$(grep -oE "case '[a-z._]+'" "$WEBHOOK_FILE" 2>/dev/null | sort -u)
    EVENT_COUNT=$(echo "$EVENTS" | grep -c . || true)
    echo "    Registered events ($EVENT_COUNT):"
    echo "$EVENTS" | sed "s/^/      /"

    REQUIRED_EVENTS=(
      "payment_intent.succeeded"
      "payment_intent.payment_failed"
      "charge.refunded"
      "account.updated"
    )
    for EVT in "${REQUIRED_EVENTS[@]}"; do
      if echo "$EVENTS" | grep -q "$EVT"; then
        pass "Webhook handles $EVT"
      else
        warning "Webhook missing handler for $EVT"
      fi
    done
  else
    info "webhooks.ts not found"
  fi

  # --- 8f. Payout tier gating ---
  echo -e "\n  ${BOLD}Payout Tier Gating:${NC}"
  PAYOUT_FILE="src/lib/actions/payout-settings.ts"
  if [ -f "$PAYOUT_FILE" ]; then
    TIER_CHECK=$(grep -c "storeTier\|TIER_PAYOUT\|payoutFrequency\|PERSONAL\|BUSINESS\|POWER" "$PAYOUT_FILE" 2>/dev/null || true)
    if [ "$TIER_CHECK" -gt 0 ]; then
      pass "Payout settings enforce tier gating ($TIER_CHECK references)"
    else
      warning "Payout settings may not enforce tier gating"
    fi
  else
    info "payout-settings.ts not found"
  fi
}

# =====================================================================
# STREAM 9: Code Hygiene
# =====================================================================
run_hygiene() {
  section "9: Code Hygiene"

  # --- 9a. console.log in production code ---
  echo -e "\n  ${BOLD}console.log in Production Code:${NC}"
  CONSOLE_LOG=$(grep -rn "console\.log(" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|test-\|seed\|seed-\|mock\|\.spec\.\|//.*console\|logger\.ts" || true)
  CONSOLE_COUNT=$(echo "$CONSOLE_LOG" | grep -c . || true)
  if [ "$CONSOLE_COUNT" -gt 0 ]; then
    blocker "console.log in production code — $CONSOLE_COUNT occurrence(s)"
    echo "$CONSOLE_LOG" | head -10
    if [ "$CONSOLE_COUNT" -gt 10 ]; then
      echo "    ... and $((CONSOLE_COUNT - 10)) more"
    fi
  else
    pass "No console.log in production code"
  fi

  # --- 9b. console.error/warn that should use logger ---
  echo -e "\n  ${BOLD}console.error/warn (should use structured logger):${NC}"
  CONSOLE_ERR=$(grep -rn "console\.error\|console\.warn" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|test-\|seed\|mock\|\.spec\." || true)
  CONSOLE_ERR_COUNT=$(echo "$CONSOLE_ERR" | grep -c . || true)
  if [ "$CONSOLE_ERR_COUNT" -gt 0 ]; then
    warning "console.error/warn in production — $CONSOLE_ERR_COUNT (should use structured logger)"
    echo "$CONSOLE_ERR" | head -5
  else
    pass "No console.error/warn in production code"
  fi

  # --- 9c. File size check (test files reported as WARNING, production as BLOCKER) ---
  echo -e "\n  ${BOLD}File Size Limits:${NC}"
  OVER_300=0
  OVER_250=0
  while IFS= read -r LINE; do
    LINES=$(echo "$LINE" | awk '{print $1}')
    FILE=$(echo "$LINE" | awk '{print $2}')
    [ "$FILE" = "total" ] && continue
    [ -z "$LINES" ] && continue

    IS_TEST=0
    [[ "$FILE" == *"__tests__"* || "$FILE" == *".test."* || "$FILE" == *".spec."* ]] && IS_TEST=1

    if [ "$LINES" -gt 300 ]; then
      if [ "$IS_TEST" -eq 1 ]; then
        warning "$FILE: $LINES lines (test file over 300)"
      else
        blocker "$FILE: $LINES lines (over 300 limit)"
      fi
      OVER_300=$((OVER_300 + 1))
    elif [ "$LINES" -gt 250 ]; then
      info "$FILE: $LINES lines (approaching 300 limit)"
      OVER_250=$((OVER_250 + 1))
    fi
  done < <(find src -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | sort -rn | head -50)

  if [ "$OVER_300" -eq 0 ]; then
    pass "All files under 300 lines"
  fi

  # --- 9d. as unknown as (outside tests) ---
  echo -e "\n  ${BOLD}Type Assertion Abuse:${NC}"
  AS_UNKNOWN=$(grep -rn "as unknown as" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|test-\|mock\|\.spec\." || true)
  AS_COUNT=$(echo "$AS_UNKNOWN" | grep -c . || true)
  if [ "$AS_COUNT" -gt 0 ]; then
    blocker "\"as unknown as\" in production code — $AS_COUNT occurrence(s)"
    echo "$AS_UNKNOWN" | head -5
  else
    pass "No 'as unknown as' in production code"
  fi

  # --- 9e. z.string().min(1) on ID fields in actions/queries ---
  # NOTE: Validation schemas use internalId (min(1)) intentionally for server-rendered
  # IDs (seed-format or cuid2). Stream 11e checks for .cuid2() on internal IDs instead.
  echo -e "\n  ${BOLD}Weak ID Validation (actions/queries only):${NC}"
  WEAK_ID=$(grep -rn 'z\.string()\.min(1)' src/lib/actions/ src/lib/queries/ --include="*.ts" 2>/dev/null | \
    grep -i "id\b\|Id:" | grep -v "__tests__\|\.test\.\|seed\|mock\|validations/" || true)
  WEAK_ID_COUNT=$(echo "$WEAK_ID" | grep -c . || true)
  if [ "$WEAK_ID_COUNT" -gt 0 ]; then
    warning "z.string().min(1) on ID fields in actions/queries — $WEAK_ID_COUNT occurrence(s)"
    echo "$WEAK_ID" | head -5
  else
    pass "No weak ID validation in actions/queries"
  fi

  # --- 9f. Top 10 largest files ---
  echo -e "\n  ${BOLD}Top 10 Largest Files:${NC}"
  set +e
  set +o pipefail
  # NOTE: xargs may split the file list across multiple invocations,
  # producing multiple "total" lines. Filter them BEFORE sort.
  TOP10=$(find src \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null \
    | xargs wc -l 2>/dev/null \
    | grep -v " total$" \
    | sort -rn \
    | head -10)
  while IFS= read -r LINE; do
    [ -z "$LINE" ] && continue
    LINES=$(echo "$LINE" | awk '{print $1}')
    FILE=$(echo "$LINE" | awk '{print $2}')
    [ "$FILE" = "total" ] && continue
    if [ "$LINES" -gt 250 ]; then
      echo -e "    ${YELLOW}${LINES}${NC}  $FILE"
    else
      echo "    ${LINES}  $FILE"
    fi
  done <<< "$TOP10"
  set -e
  set -o pipefail
}

# =====================================================================
# STREAM 10a: Smoke Tests (HTTP)
# =====================================================================
run_smoke() {
  section "10a: Smoke Tests (HTTP)"

  # --- Detect running server ---
  PORT="${SMOKE_PORT:-3000}"
  echo -e "\n  ${BOLD}Checking for dev server on port ${PORT}...${NC}"

  SERVER_UP=0
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}" --max-time 3 2>/dev/null | grep -qE "200|302|307"; then
    SERVER_UP=1
    pass "Dev server detected on port ${PORT}"
  else
    info "No dev server on port ${PORT} — skipping HTTP smoke tests"
    echo -e "  To run smoke tests: start dev server (pnpm dev) then re-run."
    echo -e "  TypeScript/build checks are handled by twicely-lint.sh [1/7]."
    return
  fi

  # --- Critical routes to smoke test ---
  echo -e "\n  ${BOLD}HTTP Smoke Tests:${NC}"

  # Format: "URL|expected_status|description"
  SMOKE_ROUTES=(
    # ── Core / Public (Phase A) ──
    "/|200|Homepage"
    "/auth/login|200|Login page"
    "/auth/signup|200|Register page"
    "/auth/forgot-password|200|Forgot password"
    "/s?q=test|200|Search page"
    "/pricing|200|Pricing page"
    "/about|200|About page"
    # ── Policy pages (Phase A) ──
    "/p/buyer-protection|200|Buyer protection"
    "/p/how-it-works|200|How it works"
    "/p/fees|200|Fees page"
    "/p/policies|200|Policies page"
    "/p/terms|200|Terms of service"
    "/p/privacy|200|Privacy policy"
    # ── Help center (Phase A) ──
    "/h|200|Help center home"
    "/h/contact|200|Contact support"
    # ── Commerce (Phase C) ──
    "/cart|200|Cart page"
    # ── User hub (Phase B+) ──
    "/my|200|Hub home"
    "/my/buying|200|Buying dashboard"
    "/my/buying/orders|200|Purchase orders"
    "/my/buying/offers|200|My offers"
    "/my/buying/watchlist|200|Watchlist"
    "/my/buying/alerts|200|Price alerts"
    "/my/buying/following|200|Following"
    "/my/buying/searches|200|Saved searches"
    "/my/buying/history|200|Purchase history"
    "/my/buying/reviews|200|My reviews"
    "/my/selling|200|Selling dashboard"
    "/my/selling/orders|200|Sales orders"
    "/my/selling/listings|200|My listings"
    "/my/selling/listings/new|200|Create listing"
    "/my/selling/offers|200|Offers received"
    "/my/selling/returns|200|Returns"
    "/my/selling/shipping|200|Shipping settings"
    "/my/selling/store|200|Store settings"
    "/my/selling/promotions|200|Promotions"
    "/my/selling/promoted|200|Promoted listings"
    "/my/selling/staff|200|Staff management"
    "/my/selling/onboarding|200|Seller onboarding"
    # ── Crosslister (Phase F) ──
    "/my/selling/crosslist|200|Crosslister home"
    "/my/selling/crosslist/connect|200|Connect platforms"
    "/my/selling/crosslist/import|200|Import listings"
    "/my/selling/crosslist/automation|200|Automation settings"
    # ── Finances (Phase D) ──
    "/my/selling/finances|200|Finances overview"
    "/my/selling/finances/transactions|200|Transactions"
    "/my/selling/finances/payouts|200|Payouts"
    "/my/selling/subscription|200|Subscription"
    # ── Settings ──
    "/my/settings|200|Settings"
    "/my/settings/addresses|200|Addresses"
    "/my/settings/security|200|Security"
    "/my/settings/notifications|200|Notifications"
    # ── Messages ──
    "/my/messages|200|Messages"
    # ── Support ──
    "/my/support|200|Support cases"
  )

  SMOKE_PASS=0
  SMOKE_FAIL=0
  for ROUTE_ENTRY in "${SMOKE_ROUTES[@]}"; do
    URL_PATH=$(echo "$ROUTE_ENTRY" | cut -d'|' -f1)
    EXPECTED=$(echo "$ROUTE_ENTRY" | cut -d'|' -f2)
    DESC=$(echo "$ROUTE_ENTRY" | cut -d'|' -f3)

    ACTUAL=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}${URL_PATH}" --max-time 5 -L 2>/dev/null || echo "000")

    if [ "$ACTUAL" = "$EXPECTED" ]; then
      pass "${DESC} (${URL_PATH}) — ${ACTUAL}"
      SMOKE_PASS=$((SMOKE_PASS + 1))
    elif [ "$ACTUAL" = "000" ]; then
      blocker "${DESC} (${URL_PATH}) — timeout/connection refused"
      SMOKE_FAIL=$((SMOKE_FAIL + 1))
    elif [ "$EXPECTED" = "302" ] && echo "$ACTUAL" | grep -qE "301|302|303|307|308"; then
      pass "${DESC} (${URL_PATH}) — ${ACTUAL} (redirect, expected ${EXPECTED})"
      SMOKE_PASS=$((SMOKE_PASS + 1))
    elif [ "$EXPECTED" = "200" ] && [ "$ACTUAL" = "200" ]; then
      pass "${DESC} (${URL_PATH}) — 200"
      SMOKE_PASS=$((SMOKE_PASS + 1))
    else
      blocker "${DESC} (${URL_PATH}) — got ${ACTUAL}, expected ${EXPECTED}"
      SMOKE_FAIL=$((SMOKE_FAIL + 1))
    fi
  done

  echo ""
  if [ "$SMOKE_FAIL" -eq 0 ]; then
    pass "All ${SMOKE_PASS} smoke tests passed"
  else
    blocker "${SMOKE_FAIL}/${SMOKE_PASS} smoke tests failed"
  fi

  # --- Check for error pages (500s) on hub routes ---
  echo -e "\n  ${BOLD}Hub Route Smoke (expected 302 for unauthenticated):${NC}"
  HUB_ROUTES=("/d" "/usr" "/tx" "/tx/orders" "/tx/payments" "/fin" "/fin/ledger" "/fin/payouts" "/fin/costs" "/fin/adjustments" "/fin/recon" "/mod" "/mod/listings" "/mod/reviews" "/mod/disputes" "/cfg" "/cfg/platform" "/cfg/monetization" "/cfg/environment" "/cfg/modules" "/cfg/trust" "/cfg/stripe" "/cfg/shippo" "/cfg/providers" "/cfg/meetup-locations" "/roles" "/roles/staff" "/roles/custom" "/health" "/health/doctor" "/flags" "/audit")
  for HR in "${HUB_ROUTES[@]}"; do
    ACTUAL=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}${HR}" --max-time 5 2>/dev/null || echo "000")
    if echo "$ACTUAL" | grep -qE "302|303|307|308|200"; then
      pass "Hub ${HR} — ${ACTUAL}"
    elif [ "$ACTUAL" = "500" ]; then
      blocker "Hub ${HR} — 500 Server Error"
    elif [ "$ACTUAL" = "000" ]; then
      warning "Hub ${HR} — timeout"
    else
      info "Hub ${HR} — ${ACTUAL}"
    fi
  done

  # --- API health check ---
  echo -e "\n  ${BOLD}API Health:${NC}"
  API_ROUTES=("/api/health")
  for AR in "${API_ROUTES[@]}"; do
    ACTUAL=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}${AR}" --max-time 5 2>/dev/null || echo "000")
    if [ "$ACTUAL" = "200" ]; then
      pass "API ${AR} — 200"
    elif [ "$ACTUAL" = "404" ]; then
      info "API ${AR} — 404 (health endpoint not implemented yet)"
    else
      warning "API ${AR} — ${ACTUAL}"
    fi
  done
}

# =====================================================================
# STREAM 11: Runtime Safety — catches things that compile but break at runtime
# =====================================================================
run_runtime() {
  section "11: Runtime Safety"

  # --- 11a. dangerouslySetInnerHTML (XSS risk) ---
  # Safe patterns: JSON-LD <script> tags use JSON.stringify (no user HTML),
  # DOMPurify.sanitize() is properly sanitized. Check entire FILE for sanitization,
  # not just the line with dangerouslySetInnerHTML (sanitize often on a different line).
  echo -e "\n  ${BOLD}dangerouslySetInnerHTML (XSS risk):${NC}"
  XSS_UNSAFE=0
  XSS_SAFE_COUNT=0
  for FILE in $(grep -rln "dangerouslySetInnerHTML" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|\.spec\.\|mock\|seed"); do
    # Check if the FILE (not just the line) has sanitization
    HAS_SANITIZER=$(grep -c "DOMPurify\|sanitize\|JSON\.stringify" "$FILE" 2>/dev/null || true)
    if [ "$HAS_SANITIZER" -gt 0 ]; then
      XSS_SAFE_COUNT=$((XSS_SAFE_COUNT + 1))
    else
      LINES=$(grep -n "dangerouslySetInnerHTML" "$FILE" 2>/dev/null || true)
      blocker "Unsanitized dangerouslySetInnerHTML: $(echo $FILE | sed 's|.*/src/|src/|')"
      echo "$LINES" | while IFS= read -r LINE; do echo "    $LINE"; done
      XSS_UNSAFE=$((XSS_UNSAFE + 1))
    fi
  done
  if [ "$XSS_UNSAFE" -eq 0 ]; then
    pass "No unsanitized dangerouslySetInnerHTML"
  fi
  if [ "$XSS_SAFE_COUNT" -gt 0 ]; then
    info "dangerouslySetInnerHTML with sanitization — $XSS_SAFE_COUNT file(s) (JSON-LD/DOMPurify, acceptable)"
  fi

  # --- 11b. eslint-disable comments (hiding real bugs) ---
  echo -e "\n  ${BOLD}eslint-disable Comments (suppressed warnings):${NC}"
  ESLINT_SUPPRESS=$(grep -rn "eslint-disable" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|\.spec\.\|node_modules" || true)
  ESLINT_COUNT=$(echo "$ESLINT_SUPPRESS" | grep -c . || true)
  if [ "$ESLINT_COUNT" -gt 0 ]; then
    warning "eslint-disable in production code — $ESLINT_COUNT comment(s) hiding potential bugs"
    echo "$ESLINT_SUPPRESS" | while IFS= read -r LINE; do
      echo "    $LINE"
    done
  else
    pass "No eslint-disable comments in production code"
  fi

  # --- 11c. Empty catch blocks (swallowed errors) ---
  echo -e "\n  ${BOLD}Empty Catch Blocks (swallowed errors):${NC}"
  EMPTY_CATCH=$(grep -rn "catch\s*([^)]*)\s*{\s*}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|\.spec\.\|mock\|seed" || true)
  # Also check for catch {} with no variable
  EMPTY_CATCH2=$(grep -rn "catch\s*{\s*}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|\.spec\.\|mock\|seed" || true)
  COMBINED_CATCH="$EMPTY_CATCH
$EMPTY_CATCH2"
  CATCH_COUNT=$(echo "$COMBINED_CATCH" | grep -c . || true)
  if [ "$CATCH_COUNT" -gt 0 ]; then
    warning "Empty catch blocks — $CATCH_COUNT (errors silently swallowed)"
    echo "$COMBINED_CATCH" | grep . | head -10 | while IFS= read -r LINE; do
      echo "    $LINE"
    done
  else
    pass "No empty catch blocks"
  fi

  # --- 11d. Browser API usage in server files (SSR crash) ---
  # Only flag actual browser API calls, not "window" in comments/strings
  # (e.g., "time window", "cookie window", "attribution window" are NOT browser globals)
  echo -e "\n  ${BOLD}Browser API in Server Files (SSR crash):${NC}"
  SERVER_BROWSER=0
  BROWSER_APIS="window\.location\|window\.addEventListener\|window\.open\|window\.scrollTo\|window\.history\|window\.navigator\|window\.matchMedia\|window\.innerWidth\|window\.innerHeight\|window\.performance\|window\.postMessage\|window\.close\|window\.alert\|window\.confirm\|window\.prompt\|document\.getElementById\|document\.querySelector\|document\.createElement\|document\.cookie\|document\.body\|document\.addEventListener\|document\.title\|document\.head\|localStorage\.\|sessionStorage\."
  for FILE in $(find src -name "*.ts" -o -name "*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|\.spec\.\|node_modules\|\.d\.ts"); do
    HEAD=$(head -5 "$FILE" 2>/dev/null)
    if echo "$HEAD" | grep -q '"use client"\|'\''use client'\'''; then
      continue
    fi
    BROWSER_USE=$(grep -n "$BROWSER_APIS" "$FILE" 2>/dev/null | \
      grep -v "typeof window\|typeof document\|// \|/\*\| \* " || true)
    if [ -n "$BROWSER_USE" ]; then
      BCOUNT=$(echo "$BROWSER_USE" | grep -c . || true)
      blocker "Browser API in server file: $(echo $FILE | sed 's|.*/src/|src/|') ($BCOUNT lines)"
      echo "$BROWSER_USE" | head -3 | while IFS= read -r LINE; do
        echo "    $LINE"
      done
      SERVER_BROWSER=$((SERVER_BROWSER + 1))
    fi
  done
  if [ "$SERVER_BROWSER" -eq 0 ]; then
    pass "No browser API usage in server files"
  fi

  # --- 11e. Zod .cuid2() on internal/server-rendered IDs ---
  echo -e "\n  ${BOLD}Strict cuid2() on Internal IDs (breaks with seed data):${NC}"
  # Check validation files for .cuid2() used on IDs that are server-rendered
  # (caseId, staffId, teamId, macroId, ruleId, policyId, articleId, categoryId)
  INTERNAL_ID_PATTERNS="caseId.*cuid2\|staffId.*cuid2\|agentId.*cuid2\|teamId.*cuid2\|macroId.*cuid2\|ruleId.*cuid2\|policyId.*cuid2\|requesterId.*cuid2"
  CUID2_INTERNAL=$(grep -rn "$INTERNAL_ID_PATTERNS" src/lib/validations/ --include="*.ts" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|mock" || true)
  CUID2_COUNT=$(echo "$CUID2_INTERNAL" | grep -c . || true)
  if [ "$CUID2_COUNT" -gt 0 ]; then
    blocker "Zod .cuid2() on internal IDs — $CUID2_COUNT (will reject seed-format IDs at runtime)"
    echo "$CUID2_INTERNAL" | while IFS= read -r LINE; do
      echo "    $LINE"
    done
  else
    pass "No strict cuid2() on internal ID fields"
  fi

  # --- 11f. Href construction with wrong route segments ---
  echo -e "\n  ${BOLD}Suspicious Href Constructions:${NC}"
  HREF_ISSUES=0
  # Check for /tx/ without /tx/orders/ or /tx/payments/ (common mistake)
  BAD_TX=$(grep -rn 'href=.*`/tx/\${' src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "/tx/orders/\|/tx/payments/\|__tests__\|\.test\." || true)
  BAD_TX_COUNT=$(echo "$BAD_TX" | grep -c . || true)
  if [ "$BAD_TX_COUNT" -gt 0 ]; then
    blocker "Bare /tx/\${id} href (should be /tx/orders/\${id} or /tx/payments/\${id}) — $BAD_TX_COUNT"
    echo "$BAD_TX" | while IFS= read -r LINE; do echo "    $LINE"; done
    HREF_ISSUES=$((HREF_ISSUES + BAD_TX_COUNT))
  fi
  # Check for /hd/ links to non-existent sub-routes
  BAD_HD=$(grep -rn 'href=.*"/hd/' src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "/hd/cases\|/hd/resolved\|/hd/reports\|/hd/teams\|/hd/macros\|/hd/automation\|/hd/routing\|/hd/views\|/hd/sla\|/hd/settings\|/hd/kb\|/hd\"\|__tests__\|\.test\." || true)
  BAD_HD_COUNT=$(echo "$BAD_HD" | grep -c . || true)
  if [ "$BAD_HD_COUNT" -gt 0 ]; then
    warning "Helpdesk href to unknown sub-route — $BAD_HD_COUNT"
    echo "$BAD_HD" | while IFS= read -r LINE; do echo "    $LINE"; done
    HREF_ISSUES=$((HREF_ISSUES + BAD_HD_COUNT))
  fi
  if [ "$HREF_ISSUES" -eq 0 ]; then
    pass "No suspicious href constructions"
  fi

  # --- 11g. Server actions without ANY error handling in UI ---
  # NOTE: Most server actions return { success, error } which is handled via
  # result checking, not try/catch. Only flag files with 4+ unguarded transitions
  # AND no error/result checking at all (neither try/catch nor result.error).
  echo -e "\n  ${BOLD}Unguarded Server Action Calls in UI:${NC}"
  UNGUARDED=0
  for FILE in $(grep -rln "startTransition" src/ --include="*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|\.spec\."); do
    ST_COUNT=$(grep -c "startTransition" "$FILE" 2>/dev/null || true)
    # Check for any form of error handling: try/catch OR result.error OR .error OR toast.error
    ERR_HANDLING=$(grep -c "\btry\b\|result\.error\|\.error\b\|toast\.error\|setError\|onError" "$FILE" 2>/dev/null || true)
    if [ "$ST_COUNT" -ge 4 ] && [ "$ERR_HANDLING" -eq 0 ]; then
      warning "$(echo $FILE | sed 's|.*/src/|src/|') — $ST_COUNT startTransition(s) with NO error handling"
      UNGUARDED=$((UNGUARDED + 1))
    fi
  done
  if [ "$UNGUARDED" -eq 0 ]; then
    pass "All files with startTransition have some error handling"
  fi

  # --- 11h. "use client" importing directly from server-only modules ---
  echo -e "\n  ${BOLD}Client Components Importing Server Modules:${NC}"
  CLIENT_SERVER=0
  for FILE in $(grep -rln '"use client"' src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|\.spec\."); do
    # Check for imports from @/lib/db (NOT @/lib/db/schema which may be type-only)
    SERVER_IMPORTS=$(grep -n "from '@/lib/db'" "$FILE" 2>/dev/null | grep -v "type {" || true)
    SERVER_IMPORTS2=$(grep -n "from 'drizzle-orm'" "$FILE" 2>/dev/null || true)
    SERVER_IMPORTS3=$(grep -n "from '@/lib/stripe'" "$FILE" 2>/dev/null | grep -v "type {" || true)
    ALL_SERVER="$SERVER_IMPORTS
$SERVER_IMPORTS2
$SERVER_IMPORTS3"
    ALL_COUNT=$(echo "$ALL_SERVER" | grep -c . || true)
    if [ "$ALL_COUNT" -gt 0 ]; then
      blocker "Client component imports server module: $(echo $FILE | sed 's|.*/src/|src/|')"
      echo "$ALL_SERVER" | grep . | while IFS= read -r LINE; do echo "    $LINE"; done
      CLIENT_SERVER=$((CLIENT_SERVER + 1))
    fi
  done
  if [ "$CLIENT_SERVER" -eq 0 ]; then
    pass "No client components importing server modules"
  fi

  # --- 11i. Form/button actions that could fail silently ---
  echo -e "\n  ${BOLD}Void Async Calls (fire-and-forget without error handling):${NC}"
  VOID_ASYNC=$(grep -rn "void [a-zA-Z]*(" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "__tests__\|\.test\.\|\.spec\.\|mock\|// void\|void 0\|void type\|\.d\.ts" || true)
  VOID_COUNT=$(echo "$VOID_ASYNC" | grep -c . || true)
  if [ "$VOID_COUNT" -gt 0 ]; then
    info "void async calls — $VOID_COUNT (verify error handling exists upstream)"
    echo "$VOID_ASYNC" | head -5 | while IFS= read -r LINE; do
      echo "    $LINE"
    done
    if [ "$VOID_COUNT" -gt 5 ]; then
      echo "    ... and $((VOID_COUNT - 5)) more"
    fi
  else
    pass "No fire-and-forget void async calls"
  fi
}

# =====================================================================
# DISPATCH
# =====================================================================

case "$STREAM" in
  money|5)    run_money ;;
  wiring|7)   run_wiring ;;
  stripe|8)   run_stripe ;;
  hygiene|9)  run_hygiene ;;
  smoke|10|10a) run_smoke ;;
  runtime|11) run_runtime ;;
  all|quick|full)
    run_money
    run_wiring
    run_stripe
    run_hygiene
    run_runtime
    run_smoke
    ;;
  *)
    echo "Unknown stream: $STREAM"
    echo "Usage: bash twicely-audit.sh [money|wiring|stripe|hygiene|runtime|smoke|all]"
    exit 1
    ;;
esac

# =====================================================================
# SUMMARY
# =====================================================================
echo ""
echo -e "${BOLD}=======================================${NC}"
echo -e "  BLOCKERS: ${BLOCKERS}"
echo -e "  WARNINGS: ${WARNINGS}"
echo -e "  INFO:     ${INFOS}"
echo ""
if [ "$BLOCKERS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}ALL SHELL STREAMS CLEAN${NC}"
elif [ "$BLOCKERS" -eq 0 ]; then
  echo -e "  ${YELLOW}${BOLD}PASS WITH $WARNINGS WARNING(S)${NC}"
else
  echo -e "  ${RED}${BOLD}$BLOCKERS BLOCKER(S) FOUND${NC}"
fi
echo -e "${BOLD}=======================================${NC}"

exit $BLOCKERS
