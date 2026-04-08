---
name: R7 image retention job lives in packages/jobs, not packages/crosslister
description: The tiered image retention cleanup (Decision #111) is implemented in packages/jobs/src/listing-image-retention.ts
type: feedback
---

Business rule R7 (image retention tiered by age + status) is NOT a file in `packages/crosslister/src`. It lives at `packages/jobs/src/listing-image-retention.ts` as a scheduled cron job.

**Why:** Image cleanup is a scheduled maintenance job, not a real-time crosslister operation. The jobs package owns all cron workers; crosslister is a real-time engine. The retention job reads `crosslister.images.*` platform_settings keys (variantPurgeAfterDays, fullPurgeAfterDays, batchSize), confirming it is crosslister-owned logic hosted in the jobs package.

**How to apply:** When verifying R7, check `packages/jobs/src/listing-image-retention.ts`. The crosslister package itself has no image cleanup code — that is correct. Test file: `packages/jobs/src/__tests__/listing-image-retention.test.ts`.
