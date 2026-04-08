---
name: First full audit run results (2026-04-08)
description: DRIFT verdict from inaugural hub-local domain audit — two missing canonical UI file paths and one stale noShowFee display in local-transaction-detail.tsx
type: project
---

Audit date: 2026-04-08

**Verdict: DRIFT (non-blocking)**

**Why:** Two files that the agent system prompt lists as in-scope are absent as standalone files:
- `apps/web/src/components/storefront/storefront-header-local.tsx` — local metrics were absorbed into the main `storefront-header.tsx` component; test file exists at `storefront/__ tests__/storefront-header-local.test.tsx`
- `apps/web/src/components/pages/listing/seller-card-local.tsx` — local metrics were absorbed into `seller-card.tsx`; test file exists at `listing/__tests__/seller-card-local.test.tsx`

**Stale UI reference:** `local-transaction-detail.tsx:123-126` still renders `noShowFeeCents` charge text. This column still exists on the schema (nullable, legacy) but A5 declared monetary no-show penalties removed. Column is schema-harmless (existing data), but UI display should be removed or hidden. Not a blocker — no active charge path exists in the action layer.

**How to apply:** On next audit check whether the two component files were intentionally absorbed or still need to be created as separate files; and whether `local-transaction-detail.tsx` noShowFee display was cleaned up.
