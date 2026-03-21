# I7 Trust & Safety Suite — Findings

## Key Architecture
- TWO parallel scoring systems: trustScore (event-delta, real, default 80) + sellerScore (metric-based, int 0-1000)
- Trust bands from Platform Settings: EXCELLENT(90+)/GOOD(75+)/WATCH(60+)/LIMITED(40+)/RESTRICTED(<40)
- Performance bands from schema enum: POWER_SELLER(900+)/TOP_RATED(750+)/ESTABLISHED(550+)/EMERGING(<550)/SUSPENDED
- Both coexist on sellerProfile — display both in hub pages
- sellerPerformance table has cached aggregates (sellerProfileId FK, NOT userId)
- sellerScoreSnapshot has daily snapshots (userId FK, snapshotDate column)
- auditEvent has security events (action LIKE 'security.%')

## Existing Code Inventory
- `/cfg/trust` page EXISTS: simple trust settings toggles (auto-moderation, fraud detection, identity verification)
- `/trust`, `/risk`, `/security` directories DO NOT exist yet
- admin-nav.ts has cfg-trust entry but NO entries for /trust, /risk, /security top-level routes
- CASL subjects missing: TrustSafety, SecurityEvent (specified in Actors/Security Section 19)
- FraudCase subject specified but NO fraud_case table exists — deferred

## Trust Platform Settings (seeded in v32-platform-settings-extended.ts)
- trust.baseScore=80, trust.bandExcellentMin=90, trust.bandGoodMin=75, trust.bandWatchMin=60, trust.bandLimitedMin=40
- trust.volumeCapped=10, trust.volumeLimited=50, trust.decayHalfLifeDays=90
- 12 trust.event.* weights (review1-5Star, lateShipment, sellerCancel, refundSellerFault, disputeOpened, disputeSellerFault, chargeback, policyViolation)
- trust.standards.* keys (evaluation period, defect thresholds, etc.)
- trust.protection.* keys (claim windows, auto-approve thresholds)
- trust.review.* keys (eligible days, window, moderation)

## CASL Auth Pattern
- MODERATION + SUPPORT: read TrustSafety (view scores/profiles)
- ADMIN: manage all (covers TrustSafety, SecurityEvent)
- SRE: read HealthCheck + AuditEvent (security events via AuditEvent)
- Trust settings: ability.can('update', 'Setting') — ADMIN only
- Band overrides: ability.can('update', 'SellerProfile') — ADMIN only

## Spec Gaps Documented
1. Two parallel scoring systems (trustScore vs sellerScore) — owner decision needed
2. /corp/ prefix in Actors/Security doc superseded by Page Registry
3. FraudCase CASL subject has no backing table
4. trust.standards.belowStandardFvfSurcharge uses banned term FVF in key name

## Files: 11 total (2 modified, 9 new), ~28 tests
