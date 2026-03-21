# H2.3 Whatnot Sale Webhook -- Research Findings

## Existing Code Inventory
- `sale-webhook-handler.ts` (102 lines) -- eBay handler only, handleEbaySaleWebhook
- `sale-polling-handler.ts` (98 lines) -- parsePollResult for platforms without webhooks
- `sale-detection.ts` (253 lines) -- handleDetectedSale: idempotent, marks SOLD, emergency delists, ledger, notifications
- `post-off-platform-sale.ts` (122 lines) -- CROSSLISTER_SALE_REVENUE + CROSSLISTER_PLATFORM_FEE ledger entries
- `platform-fees.ts` (~88 lines) -- getPlatformFeeRate + calculatePlatformFee, WHATNOT already mapped (key: whatnot, default: 1000 bps)
- `whatnot-connector.ts` (705 lines) -- hasWebhooks: false on line 59, needs update to true
- `whatnot-types.ts` (121 lines) -- token, profile, listing types, no webhook types yet
- `whatnot-schemas.ts` (~56 lines) -- listing + token schemas, no webhook schemas yet
- `whatnot-normalizer.ts` (151 lines) -- parseMoneyToCents already exists, reusable

## Missing Seeds
- `crosslister.fees.whatnot.rateBps` NOT in seed-crosslister.ts (all other 8 channels have it, lines 80-87)
- `crosslister.whatnot.webhookSecret` NOT in seed-crosslister.ts (needed for HMAC verification)
- Default fallback of 1000 bps (10%) works in platform-fees.ts line 44 but seed should exist for admin config

## channelEnum State
- Already includes WHATNOT (10th value, added in H2.1)
- No Drizzle migration needed for H2.3

## Pattern Analysis
- Stripe webhook pattern: raw body via request.text(), signature check, then JSON parse
- eBay sale webhook handler: simple normalize -> lookup projection -> compute fee -> call handleDetectedSale
- handleDetectedSale does ALL downstream work: mark SOLD, emergency delists, ledger, notify, Centrifugo
- Idempotency is in handleDetectedSale (checks projection.status === 'SOLD')

## Spec Gaps
- Whatnot webhook payload structure is assumed (not publicly documented)
- Whatnot signature header name is assumed (X-Whatnot-Signature)
- Event type string is assumed (order.completed)
- No automatic webhook registration -- admin must configure manually
