#!/bin/bash
# RETROACTIVE DEEP AUDIT — Waves 1-3
# Traces actual execution paths, not just keyword existence
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
ISSUES=0
WARNINGS=0

section() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; ISSUES=$((ISSUES + 1)); }
warn() { echo -e "  ${YELLOW}⚠ ${NC} $1"; WARNINGS=$((WARNINGS + 1)); }

echo "════════════════════════════════════════════"
echo "  RETROACTIVE DEEP AUDIT — WAVES 1-3"
echo "  $(date '+%Y-%m-%d %H:%M')"
echo "════════════════════════════════════════════"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "1. NOTIFICATION PATH TRACING"
# For EVERY template key: is notify() called with it from business logic?
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "  All template keys defined:"
TEMPLATES=$(grep -oE "'[a-z]+\.[a-z_.]+'" src/lib/notifications/templates.ts 2>/dev/null | sort -u)
echo "$TEMPLATES" | sed 's/^/    /'

echo ""
echo "  Checking each template has a notify() trigger in business logic..."
UNWIRED=0
while IFS= read -r TPL; do
  [ -z "$TPL" ] && continue
  HITS=$(grep -rn "notify.*$TPL\|sendNotification.*$TPL" \
    src/lib/commerce src/lib/actions src/lib/stripe src/app \
    --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "templates\.ts\|service\.tsx\|seed-\|test\|__tests__\|email/" | wc -l || true)
  if [ "$HITS" -eq 0 ]; then
    fail "UNWIRED TEMPLATE: $TPL — defined but notify() never called from business logic"
    UNWIRED=$((UNWIRED + 1))
  else
    pass "$TPL — triggered ($HITS call sites)"
  fi
done <<< "$TEMPLATES"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "2. EVERY STATE-CHANGE FUNCTION — SIDE EFFECTS"
# Functions that change order/return/dispute status MUST notify
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "  Checking state-change functions for notify() calls..."

# List of functions that SHOULD have side effects
SIDE_EFFECT_FUNCS=(
  "createReturnRequest:returns.ts:notify"
  "approveReturn:returns.ts:notify"
  "declineReturn:returns.ts:notify"
  "markReturnShipped:returns.ts:notify"
  "markReturnReceived:returns.ts:notify"
  "processReturnRefund:returns.ts:notify"
  "autoApproveOverdueReturns:returns.ts:notify"
  "escalateToDispute:disputes.ts:notify"
  "assignDispute:disputes.ts:notify"
  "resolveDispute:disputes.ts:notify"
  "createProtectionClaim:buyer-protection.ts:notify"
  "processProtectionClaim:buyer-protection.ts:notify"
  "createCounterfeitClaim:buyer-protection.ts:notify"
  "autoCreateShippingClaim:shipping-exceptions.ts:notify"
  "markOrderShipped:shipping.ts:notify"
  "cancelOrder:shipping.ts:notify"
  "markOrderDelivered:shipping.ts:notify"
  "createOffer:offer-engine.ts:notify"
  "acceptOffer:offer-engine.ts:notify"
  "declineOffer:offer-engine.ts:notify"
  "counterOffer:offer-engine.ts:notify"
  "initiateCheckout:checkout.ts:stripe"
  "finalizeOrder:checkout.ts:stripe"
  "processReturnRefund:returns.ts:stripe"
)

for ENTRY in "${SIDE_EFFECT_FUNCS[@]}"; do
  FUNC=$(echo "$ENTRY" | cut -d: -f1)
  FILE_HINT=$(echo "$ENTRY" | cut -d: -f2)
  EXPECTED=$(echo "$ENTRY" | cut -d: -f3)

  # Find the file
  FOUND_FILE=$(find src/lib -name "$FILE_HINT" ! -path "*test*" ! -path "*__tests__*" 2>/dev/null | head -1)

  if [ -z "$FOUND_FILE" ]; then
    warn "$FUNC() — file $FILE_HINT not found"
    continue
  fi

  # Check if function exists
  if ! grep -q "function $FUNC\|$FUNC = async\|$FUNC = function" "$FOUND_FILE" 2>/dev/null; then
    warn "$FUNC() — not found in $FILE_HINT (may be named differently)"
    continue
  fi

  # Check if the expected side effect exists within 80 lines after function declaration
  HAS_EFFECT=$(grep -A80 "function $FUNC\b" "$FOUND_FILE" 2>/dev/null | head -80 | grep -c "$EXPECTED" || true)

  if [ "$HAS_EFFECT" -eq 0 ]; then
    fail "$FUNC() in $FILE_HINT — MISSING $EXPECTED() call"
  else
    pass "$FUNC() — has $EXPECTED() call"
  fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "3. STRIPE API CALL COMPLETENESS"
# Every Stripe call must have required flags/params
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "  Checking Stripe refund calls..."
REFUND_FILES=$(grep -rln "refunds.create" src/lib/stripe/ 2>/dev/null || true)
for RF in $REFUND_FILES; do
  if grep -A10 "refunds.create" "$RF" 2>/dev/null | grep -q "reverse_transfer"; then
    pass "$(basename $RF) — refunds.create has reverse_transfer"
  else
    fail "$(basename $RF) — refunds.create MISSING reverse_transfer"
  fi
  if grep -A10 "refunds.create" "$RF" 2>/dev/null | grep -q "refund_application_fee"; then
    pass "$(basename $RF) — refunds.create has refund_application_fee"
  else
    fail "$(basename $RF) — refunds.create MISSING refund_application_fee"
  fi
done

echo ""
echo "  Checking Stripe PaymentIntent calls..."
PI_FILES=$(grep -rln "paymentIntents.create\|createConnectPaymentIntent" src/lib/stripe/ src/lib/actions/ 2>/dev/null || true)
for PF in $PI_FILES; do
  if grep -q "transfer_data\|destination" "$PF" 2>/dev/null || ! grep -q "paymentIntents.create" "$PF" 2>/dev/null; then
    pass "$(basename $PF) — PaymentIntent uses destination charges or is wrapper"
  else
    warn "$(basename $PF) — PaymentIntent.create without transfer_data (check if intentional)"
  fi
done

echo ""
echo "  Checking webhook handler completeness..."
WEBHOOK_EVENTS=$(grep -oE "case '[a-z.]+'" src/lib/stripe/webhooks.ts 2>/dev/null | sort -u)
echo "  Registered webhook events:"
echo "$WEBHOOK_EVENTS" | sed 's/^/    /'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "4. WAVE 1 — TRUST & REPUTATION PATH TRACE"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "  C1.1 Trust-weighted reviews..."
if grep -rq "computeReviewerTrustWeight\|computeWeightedAverageRating" src/lib/commerce/trust-weight.ts 2>/dev/null; then
  # Is it actually CALLED anywhere (not just defined)?
  CALLERS=$(grep -rn "computeReviewerTrustWeight\|computeWeightedAverageRating" src/lib src/app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "trust-weight.ts\|test\|__tests__" | wc -l || true)
  if [ "$CALLERS" -gt 0 ]; then
    pass "Trust weight functions called from $CALLERS locations"
  else
    warn "Trust weight functions EXPORTED but never CALLED outside their own file"
  fi
else
  warn "trust-weight.ts not found"
fi

echo ""
echo "  C1.2 Seller performance bands..."
PERF_CALLERS=$(grep -rn "computePerformanceBand\|updateSellerPerformanceAggregates" src/lib src/app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "performance-band.ts\|test\|__tests__" | wc -l || true)
if [ "$PERF_CALLERS" -gt 0 ]; then
  pass "Performance band functions called from $PERF_CALLERS locations"
else
  warn "Performance band functions EXPORTED but never CALLED outside their own file"
fi

echo ""
echo "  C1.3 Buyer quality tiers..."
BQ_CALLERS=$(grep -rn "computeBuyerQuality\|getBuyerQuality" src/lib src/app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "buyer-quality.ts\|test\|__tests__" | wc -l || true)
if [ "$BQ_CALLERS" -gt 0 ]; then
  pass "Buyer quality functions called from $BQ_CALLERS locations"
else
  warn "Buyer quality functions EXPORTED but never CALLED outside their own file"
fi

echo ""
echo "  C1.4 Deal badges..."
DB_CALLERS=$(grep -rn "computeDealBadge" src/lib src/app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "deal-badges.ts\|test\|__tests__" | wc -l || true)
if [ "$DB_CALLERS" -gt 0 ]; then
  pass "Deal badge functions called from $DB_CALLERS locations"
else
  warn "Deal badge functions EXPORTED but never CALLED outside their own file"
fi

echo ""
echo "  C1.5 Buyer blocking..."
BB_CALLERS=$(grep -rn "blockBuyer\|isBlocked\|getBlockedBuyers" src/lib src/app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "block\|test\|__tests__" | wc -l || true)
if [ "$BB_CALLERS" -gt 0 ]; then
  pass "Buyer blocking functions called from $BB_CALLERS locations"
else
  warn "Buyer blocking functions — check if wired into offer/purchase flow"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "5. WAVE 2 — STRIPE CONNECT PATH TRACE"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "  C3 Stripe Connect..."
echo "  Checking: does checkout verify seller is onboarded before charging?"
ONBOARD_CHECK=$(grep -rn "stripeOnboarded\|payoutsEnabled\|isSellerPaymentReady" src/lib/actions/checkout.ts 2>/dev/null | wc -l || true)
if [ "$ONBOARD_CHECK" -gt 0 ]; then
  pass "Checkout verifies seller onboarding status ($ONBOARD_CHECK checks)"
else
  fail "Checkout does NOT verify seller is onboarded before creating PaymentIntent"
fi

echo ""
echo "  C3.3 Payout frequency tier gating..."
TIER_CHECK=$(grep -rn "TIER_PAYOUT_OPTIONS\|storeTier" src/lib/actions/payout-settings.ts 2>/dev/null | wc -l || true)
if [ "$TIER_CHECK" -gt 0 ]; then
  pass "Payout settings enforce tier gating ($TIER_CHECK references)"
else
  warn "Payout settings may not enforce tier gating"
fi

echo ""
echo "  C3.4 Trial — one per product type enforcement..."
TRIAL_CHECK=$(grep -rn "trialUsage\|checkTrialEligibility\|productType" src/lib/stripe/trials.ts 2>/dev/null | wc -l || true)
if [ "$TRIAL_CHECK" -gt 0 ]; then
  pass "Trial eligibility checks product type ($TRIAL_CHECK references)"
else
  warn "Trial may not enforce one-per-product-type"
fi

echo ""
echo "  B3.2 Checkout — MIN_ORDER_CENTS enforced?"
MIN_ORDER=$(grep -rn "MIN_ORDER_CENTS" src/lib/actions/checkout.ts 2>/dev/null | wc -l || true)
if [ "$MIN_ORDER" -gt 0 ]; then
  pass "MIN_ORDER_CENTS enforced in checkout ($MIN_ORDER references)"
else
  fail "MIN_ORDER_CENTS not found in checkout"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "6. WAVE 3 — RETURNS & PROTECTION PATH TRACE"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "  C4.1 Return window enforcement..."
WINDOW_CHECK=$(grep -rn "isWithinReturnWindow\|RETURN_WINDOW_DAYS" src/lib/commerce/returns.ts 2>/dev/null | wc -l || true)
if [ "$WINDOW_CHECK" -gt 0 ]; then
  pass "Return window validated ($WINDOW_CHECK references)"
else
  fail "Return window not enforced in returns.ts"
fi

echo ""
echo "  C4.1 Auto-approve on seller timeout..."
AUTO_APPROVE=$(grep -rn "autoApproveOverdueReturns\|auto.*approve\|SELLER_RESPONSE_DAYS" src/lib/commerce/returns.ts 2>/dev/null | wc -l || true)
if [ "$AUTO_APPROVE" -gt 0 ]; then
  pass "Auto-approve logic exists ($AUTO_APPROVE references)"
  # But is it called from a cron/scheduler?
  CRON_CALL=$(grep -rn "autoApproveOverdueReturns" src/app src/lib/actions --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "returns.ts\|test" | wc -l || true)
  if [ "$CRON_CALL" -gt 0 ]; then
    pass "autoApproveOverdueReturns called from a route/cron"
  else
    warn "autoApproveOverdueReturns EXISTS but is NEVER CALLED — needs cron job or API route"
  fi
else
  fail "Auto-approve logic missing from returns.ts"
fi

echo ""
echo "  C4.2 Return fee calculation — Stripe refund path..."
# Does processReturnRefund call both calculateReturnFees AND stripe refund?
FEE_CALC=$(grep -rn "calculateReturnFees\|applyReturnFees" src/lib/commerce/ 2>/dev/null | grep -v "test\|__tests__\|return-fees.ts" | wc -l || true)
if [ "$FEE_CALC" -gt 0 ]; then
  pass "Return fee calculator called from commerce modules ($FEE_CALC references)"
else
  warn "calculateReturnFees/applyReturnFees may not be called from the refund flow"
fi

echo ""
echo "  C5.1/C5.2 Claim windows enforced..."
CLAIM_WINDOW=$(grep -rn "isWithinClaimWindow\|STANDARD_CLAIM_WINDOW\|COUNTERFEIT_CLAIM_WINDOW" src/lib/commerce/buyer-protection.ts 2>/dev/null | wc -l || true)
if [ "$CLAIM_WINDOW" -gt 0 ]; then
  pass "Claim window validation exists ($CLAIM_WINDOW references)"
else
  fail "Claim window not enforced"
fi

echo ""
echo "  C5.3 Shipping exception detection — auto-claim creation..."
SHIP_DETECT=$(grep -rn "detectShippingExceptions\|autoCreateShippingClaim\|autoCreateClaim" src/lib/commerce/shipping-exceptions.ts 2>/dev/null | wc -l || true)
if [ "$SHIP_DETECT" -gt 0 ]; then
  pass "Shipping exception detection exists ($SHIP_DETECT references)"
  # But is it called?
  SHIP_CALLER=$(grep -rn "detectShippingExceptions\|autoCreateShippingClaim\|autoCreateClaim" src/app src/lib/actions --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "shipping-exceptions.ts\|test" | wc -l || true)
  if [ "$SHIP_CALLER" -gt 0 ]; then
    pass "Shipping exception detection called from routes/actions"
  else
    warn "detectShippingExceptions EXISTS but NEVER CALLED — needs webhook trigger or cron"
  fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "7. EXPORTED-BUT-NEVER-IMPORTED (Dead Code)"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "  Scanning all commerce/stripe exports..."
DEAD=0
for DIR in src/lib/commerce src/lib/stripe src/lib/queries; do
  for FILE in "$DIR"/*.ts; do
    [ -f "$FILE" ] || continue
    [[ "$FILE" == *"test"* || "$FILE" == *"__tests__"* ]] && continue
    BASENAME=$(basename "$FILE" .ts)

    grep -oE "export (async )?function [a-zA-Z]+" "$FILE" 2>/dev/null | sed 's/export //; s/async //; s/function //' | while read -r FUNC; do
      REFS=$(grep -rn "\b$FUNC\b" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "$FILE" | grep -v "__tests__\|\.test\." | wc -l || true)
      if [ "$REFS" -eq 0 ]; then
        warn "DEAD EXPORT: $FUNC() in $BASENAME.ts — exported but never imported"
        DEAD=$((DEAD + 1))
      fi
    done
  done
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "8. FINANCIAL MATH COMPLETENESS"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "  Checking all cents arithmetic is rounded..."
for FILE in src/lib/commerce/return-fees.ts src/lib/commerce/fvf-calculator.ts src/lib/stripe/refunds.ts src/lib/stripe/server.ts src/lib/actions/checkout.ts; do
  [ -f "$FILE" ] || continue
  # Find lines with multiplication that produce decimals
  UNROUNDED=$(grep -n "\* 0\.\|/ [0-9]" "$FILE" 2>/dev/null | grep -v "Math\.\|//\|test\|PERCENT\|export const\|BPS\|10000" | wc -l || true)
  if [ "$UNROUNDED" -gt 0 ]; then
    fail "$(basename $FILE) — $UNROUNDED lines with potentially unrounded arithmetic:"
    grep -n "\* 0\.\|/ [0-9]" "$FILE" 2>/dev/null | grep -v "Math\.\|//\|test\|PERCENT\|export const\|BPS\|10000"
  else
    pass "$(basename $FILE) — all arithmetic rounded"
  fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "9. SCHEMA FIELD SAFETY"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "  Checking for known bad schema references..."
BAD_FIELDS=(
  "listing\.images"
  "dispute\.assignedToId"
  "dispute\.stripeDisputeId"
  "returnRequest\.deadlineAt"
  "returnRequest\.respondedAt[^:]"
  "order\.shippingAddress[^J]"
  "sellerProfile\.performanceBand"
)

SCHEMA_BAD=0
for PATTERN in "${BAD_FIELDS[@]}"; do
  HITS=$(grep -rn "$PATTERN" src/lib/ src/app/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "test\|__tests__\|//" | wc -l || true)
  if [ "$HITS" -gt 0 ]; then
    fail "Bad schema ref: $PATTERN ($HITS occurrences)"
    grep -rn "$PATTERN" src/lib/ src/app/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "test\|__tests__\|//" | head -3
    SCHEMA_BAD=$((SCHEMA_BAD + 1))
  fi
done

if [ "$SCHEMA_BAD" -eq 0 ]; then
  pass "No known bad schema references"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "10. FILE SIZE + TYPOS"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "  Files over 500 lines:"
find src/lib src/app -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | sort -rn | while read -r LINES FILE; do
  [ "$FILE" = "total" ] && continue
  if [ "$LINES" -gt 600 ]; then
    fail "$FILE: $LINES lines (OVER 600 — must split)"
  elif [ "$LINES" -gt 500 ]; then
    warn "$FILE: $LINES lines (approaching limit)"
  fi
done

echo ""
echo "  Checking for known typos..."
TYPO_HITS=$(grep -rn "refundToByerCents\|Byer\b" src/lib/ --include="*.ts" 2>/dev/null | grep -v "test\|__tests__" | wc -l || true)
if [ "$TYPO_HITS" -gt 0 ]; then
  warn "Typo: 'refundToByerCents' (should be 'refundToBuyerCents') — $TYPO_HITS occurrences"
  grep -rn "refundToByerCents\|Byer\b" src/lib/ --include="*.ts" 2>/dev/null | grep -v "test\|__tests__" | head -5
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "SUMMARY"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo ""
echo "════════════════════════════════════════════"
if [ "$ISSUES" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "  ${GREEN}ALL CLEAR${NC} — 0 issues, 0 warnings"
elif [ "$ISSUES" -eq 0 ]; then
  echo -e "  ${YELLOW}PASS WITH WARNINGS${NC} — 0 issues, $WARNINGS warnings"
else
  echo -e "  ${RED}$ISSUES ISSUE(S) FOUND${NC}, $WARNINGS warnings"
  echo "  Fix all ✗ items before proceeding to next wave."
fi
echo "════════════════════════════════════════════"
