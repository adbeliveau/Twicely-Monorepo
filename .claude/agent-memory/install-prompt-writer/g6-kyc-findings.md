---
name: G6 KYC & Identity Verification Findings
description: Schema gaps, existing code state, spec inconsistencies, and key decisions for G6 KYC & Privacy phase
type: project
---

## G6 KYC & Identity Verification (Prompt WRITTEN 2026-03-15)

### Schema State
- NO `identity_verification` or `data_export_request` table in schema doc (v2.1.3) — must be created
- `user.deletionRequestedAt` EXISTS (auth.ts line 27)
- `sellerProfile.verifiedAt` EXISTS (identity.ts line 42)
- `user.phoneVerified` EXISTS (auth.ts line 20)
- `user.emailVerified` EXISTS (auth.ts line 10)
- New enums needed: `verificationLevelEnum` (BASIC, TAX, ENHANCED, CATEGORY), `verificationStatusEnum` (NOT_REQUIRED, PENDING, VERIFIED, FAILED, EXPIRED)

### Existing Code
- `account-deletion.ts` EXISTS with beginAccountDeletion(), cancelAccountDeletion(), getAccountDeletionBlockers()
- GAP: beginAccountDeletion() does NOT set user.deletionRequestedAt (only calls cascadeProjectionsToOrphaned)
- Privacy settings already seeded (7 keys in v32-platform-settings-extended.ts lines 122-128)
- Missing privacy settings from Platform Settings Canonical §14: webhookLogDays, analyticsEventDays, notificationLogDays, exportFormats
- 5 new KYC settings needed: kyc.provider, enhancedThresholdCents, enhancedExpirationMonths, failedRetryDays, autoVerifyBasic
- `/p/privacy` EXISTS as stub
- `/my/settings/privacy` does NOT exist
- `/my/selling/verification` does NOT exist
- `/data-retention` does NOT exist
- No IdentityVerification/DataExportRequest/DataRetention CASL subjects yet
- No KYC/privacy notification templates exist yet

### Spec Sources
- Feature Lock-in §37: Data Retention & GDPR (30-day cooling off, pseudonymization)
- Feature Lock-in §45: Identity Verification (KYC) (4 levels, 5 triggers, flow, settings)
- Actors & Security §4: Data Protection (encryption, PII handling, GDPR, CCPA)
- Page Registry: #73 (/my/selling/verification), #78 (/my/settings/privacy), #116j (/cfg?tab=privacy), #130 (/data-retention)
- Platform Settings Canonical §14: Privacy settings
- Decision #110: 7-year financial record retention
- Decision #111: Image retention tiers

### Spec Inconsistencies
1. SSN storage: Actors Security "never stored" vs Schema doc has encrypted taxInfo (resolved in G5)
2. Cooling-off period: Feature Lock-in says 30 days, Actors Security says 24hrs (use 30 via setting)
3. Page Registry says G4 build phase for /my/selling/verification, but Build Tracker says G6
4. No schema doc table for identity_verification or data_export_request
5. privacy.dataExportMaxHours in Feature Lock-in §37 but NOT in Platform Settings Canonical §14

### Key Decisions
- 4 sub-steps: G6.1 (schema+service), G6.2 (seller page), G6.3 (privacy page), G6.4 (admin pages)
- G6.2 and G6.3 can be parallelized after G6.1
- BASIC verification = derived from emailVerified + phoneVerified (not stored as record)
- Category-specific verification deferred (future phase)
- Data export is async BullMQ job with R2 signed URL download
- 8 new notification templates (5 KYC + 3 privacy)
- 20 new files + 6 test files + 10 modified = 36 total. ~40 new tests expected
