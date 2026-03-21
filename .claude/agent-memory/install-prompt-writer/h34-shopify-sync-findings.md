---
name: H3.4 Shopify Bidirectional Sync Findings
description: Key findings from H3.4 install prompt — Shopify webhooks, HMAC (Base64 not hex), outbound sync, 3 open questions
type: project
---

## Key Facts
- Shopify HMAC uses Base64 encoding (NOT hex like Whatnot). Header: X-Shopify-Hmac-Sha256.
- Shopify doesn't wrap webhooks in an envelope. Body IS the resource. Topic from X-Shopify-Topic header.
- Shopify uses same clientSecret for both OAuth HMAC and webhook HMAC (no separate webhookSecret).
- Shopify orders can have multiple line_items — each with its own product_id to process.
- cfg/shopify page already declares webhookConfig with URL and 6 topics.
- channelProjection already has all needed columns (syncEnabled, lastCanonicalHash, hasPendingSync, externalDiff, pollTier, orphanedAt).
- crossJob already supports jobType 'SYNC' at priority 500.
- Two-way auto-sync OFF by default (Lister Canonical §14.4). Product update handler stores diff, does NOT auto-merge.

## Open Questions for Owner
1. Webhook registration timing: during OAuth callback or via admin UI?
2. products/create webhook: auto-import or acknowledge-only?
3. Outbound sync trigger: listing update action, DB trigger, or periodic BullMQ scan?

## File Count
- 12 new files + 5-6 modified = 17-18 total
- ~70 new tests estimated
- sale-webhook-handler.ts may need extraction if exceeding 300 lines
