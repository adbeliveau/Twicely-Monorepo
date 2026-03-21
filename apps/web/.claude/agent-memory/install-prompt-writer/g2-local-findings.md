# G2 — Twicely.Local Findings

## Existing Code (Pre-G2)
- `local.ts`: 85 lines, 3 tables (localTransaction, safeMeetupLocation, combinedShippingQuote)
- `enums.ts`: fulfillmentTypeEnum (3 values), localTransactionStatusEnum (9 values)
- `local-fee.ts`: 107 lines. calculateLocalTf, supportsLocalPickup, supportsShipping, getLocalTfRateBps
- `local-transaction.ts`: 288 lines. createLocalTransaction, validateConfirmationCode, validateOfflineCode, confirmLocalTransaction, recordCheckIn
- `admin-meetup-locations.ts`: 103 lines. createMeetupLocationAction, toggleMeetupLocationAction (staffAuthorize + Setting subject)
- `local-pickup.test.ts`: 243 lines. 42 tests covering fee calc, code generation, enums
- `admin-meetup-locations.test.ts`: 212 lines. 13 tests for create action
- `admin-meetup-toggle.test.ts`: 163 lines. 11 tests for toggle action
- 10 platform settings seeded: commerce.local.* (tfRateBps=500, confirmationCodeExpiryHours=48, noShowFeeCents=500, noShowStrikeLimit=3, noShowSuspensionDays=90, meetupAutoCancelMinutes=30, offlineGraceHours=2, claimWindowDays=7, defaultRadiusMiles=25, maxRadiusMiles=50)
- order table has isLocalPickup, localTransactionId columns
- listing table has fulfillmentType, localPickupRadiusMiles columns
- sellerProfile has maxMeetupDistanceMiles column

## CASL Gap (Critical for G2.1)
- LocalTransaction NOT in subjects.ts
- SafeMeetupLocation NOT in subjects.ts
- No buyer/seller abilities for local transactions
- CombinedShippingQuote IS in subjects.ts with buyer/seller/staff abilities
- Admin meetup actions use Setting subject (not SafeMeetupLocation) — correct pattern, keep it

## Schema Verification
- local.ts columns MATCH Schema doc Section 19.1-19.2 exactly
- localTransactionStatusEnum has all 9 values from schema
- No seed data for safe meetup locations (need to create in G2.1)

## Platform Settings Key Mismatch
- Local Canonical §12 uses `commerce.local.transactionFeePercent: 5.0`
- Actual seeded key is `commerce.local.tfRateBps: 500` (basis points)
- BPS format is correct per platform conventions — no issue

## Decision Rationale Entries
- #41: QR Code Escrow — single-use QR, 6-digit offline fallback, 2h offline grace
- #42: Local TF 5% flat — lower than shipped TF, covers escrow + dispute infra. No minimum for local. 0% for cash.
- #43: No-Show $5 — compensates waiting party, 3 strikes = 90-day ban from local only

## G2.8 Reliability System — Key Findings (2026-03-11)
- `local_reliability_event` table defined in Decision #114 but NOT in schema doc v2.1.0
- 4 new user columns: localReliabilityMarks, localTransactionCount, localCompletionRate, localSuspendedUntil
- New enum: localReliabilityEventTypeEnum (10 values) from Decision #114 schema section
- Old system: local-noshow-strikes.ts queries localTransaction.noShowParty/noShowFeeChargedAt for strikes
- Old system: local-noshow-check.ts writes noShowFeeCents to localTransaction row
- New system: separate localReliabilityEvent table, marks decay after 180 days, 9 marks = 90-day suspension
- Display tier boundaries NOT specified in canonical — defaulting to 0-2/3-8/9+ marks
- Addendum A0 SafeTrade matrix: reliability tracking applies to both SafeTrade AND Cash transactions
- G2.11 (cancellation) and G2.12 (day-of confirmation) will call postReliabilityMark with their event types

## NOT SPECIFIED (Owner decisions may be needed)
- Safety timer intervals (30-min nudge, 15-min escalation) have NO dedicated platform settings keys
- Local Canonical mentions cash/off-platform payment tracking but no schema support for it
- Community location suggestions workflow not detailed (just "staff reviews and approves")
- Location sharing via Centrifugo is mentioned but deferred
- Reliability display tier thresholds (RELIABLE/INCONSISTENT/UNRELIABLE) not numerically defined

## G2 Slice Dependency Chain
G2.1 (CASL/seed) → G2.2 (actions/queries) → G2.3 (UI) → G2.4 (escrow/QR scanner) → G2.5 (no-show) → G2.6 (safety) → G2.7 (admin)
G2.3 depends on G2.2 for actions but is independent from G2.4-G2.6 for basic UI.
G2.5 and G2.6 can be parallelized (both depend on G2.4 but not each other).
G2.7 can be partially parallelized with G2.5-G2.6 (admin location tab only needs G2.1).
