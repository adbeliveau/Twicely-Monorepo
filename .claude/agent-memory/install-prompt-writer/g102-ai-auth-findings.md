# G10.2 AI Authentication — Gap Analysis Findings

## Existing Implementation (EXTENSIVE)
The G10.2 feature is ~85% built. Key existing assets:

### Schema (COMPLETE)
- `authenticationRequest` table with all AI columns (status, tier, providerRef, resultJson)
- `authenticatorPartner` table
- `authenticationStatusEnum`: NONE, SELLER_VERIFIED, AI_PENDING, AI_AUTHENTICATED, AI_INCONCLUSIVE, AI_COUNTERFEIT, EXPERT_*, CERTIFICATE_EXPIRED, CERTIFICATE_REVOKED
- `listing.authenticationStatus` + `listing.authenticationRequestId` columns
- Indexes: ar_listing, ar_seller, ar_cert, ar_status, lst_auth_status

### Platform Settings (COMPLETE — 13 keys seeded)
- `trust.authentication.aiEnabled` (false by default — kill switch)
- `trust.authentication.aiFeeCents` (1999)
- `trust.authentication.aiProviderName` ('entrupy')
- `trust.authentication.aiProviderApiUrl`, aiProviderWebhookSecret, aiMaxTurnaroundHours
- `trust.authentication.aiSupportedCategories` (['HANDBAGS', 'WATCHES', 'SNEAKERS', 'TRADING_CARDS'])
- `trust.authentication.offerThresholdCents`, buyerFeeCents, sellerFeeCents, expertFeeCents, expertHighValueFeeCents, mandatoryAboveCents

### CASL (COMPLETE)
- `AuthenticationRequest` registered as CASL subject
- Seller: create, read, update (own)
- Buyer: create, read (own)
- Delegated staff: read only, CANNOT create
- Platform staff (ADMIN): manage all

### Provider Layer (COMPLETE)
- `ai-provider.ts` — AiAuthProvider interface (submit, getResult, verifyWebhook, parseWebhook)
- `entrupy-provider.ts` — Full Entrupy implementation with HMAC webhook signature verification
- `ai-provider-factory.ts` — Factory reads `trust.authentication.aiProviderName` from platform_settings

### Server Actions (COMPLETE)
- `authentication-ai.ts`: requestAiAuthentication + retryAiAuthentication (with Valkey rate limit, CASL, kill switch)
- `authentication.ts`: approveVerifiedSeller, requestItemAuthentication (Expert), submitAuthenticationPhotos
- `authentication-complete.ts`: completeAuthentication (AI+Expert branches), invalidateCertificate
- `auth-offer-check.ts`: checkAuthOfferAction (checkout flow)

### Webhook Route (COMPLETE)
- `POST /api/authentication/ai-webhook` — HMAC verification, idempotent, handles AUTHENTICATED/COUNTERFEIT/INCONCLUSIVE
- Calls notifyAuthResult() for fire-and-forget notifications

### Notifications (COMPLETE)
- 3 templates: auth.ai.authenticated, auth.ai.counterfeit, auth.ai.inconclusive
- Template keys in TemplateKey union
- auth-notifier.ts: notifies seller + buyer (if buyer-initiated)

### UI Pages (COMPLETE)
- `/my/selling/authentication` — seller auth management page with RequestAiAuthForm
- `/verify/[certNumber]` — public certificate verification page with disclaimer
- `AuthenticationBadge` component — renders on listing detail page for AI_AUTHENTICATED, AI_PENDING etc.
- `ExternalAuthDisclaimer` component — "cannot verify external claims" + nudge to Twicely auth
- `RequestAiAuthForm` — client form to submit AI auth request

### Utilities (COMPLETE)
- `cost-split.ts` — calculateAuthCostSplit (50/50 on authentic, seller-all on counterfeit, Twicely absorbs on inconclusive)
- `cert-number.ts` — generateCertNumber (TW-AUTH-XXXXX, crypto.randomBytes, collision check)
- `phash.ts` — DCT-based perceptual hash, composite hash, Hamming distance comparison, SSRF prevention
- `constants.ts` — AUTH_SETTINGS_KEYS, AUTHENTICATION_TIERS, AUTH_STATUS_AUTHENTICATED/PENDING/FAILED/INVALID
- `types.ts` — AuthenticationRequestResult, AuthenticatorPartnerSummary, CertificateVerification, AuthCostSplit

### Queries (COMPLETE)
- getAuthenticationRequestById, getAuthenticationRequestsForListing, getAuthenticationRequestsForSeller
- getSellerVerificationStatus, getAuthenticationBadgeForListing
- verifyCertificate, getAuthenticatorPartners

### packages/ai (SEPARATE, NOT WIRED)
- `packages/ai/src/features/authentication.ts` — In-house Claude Vision authentication (SUPPLEMENTARY to Entrupy)
- Uses premium vision model, checks brand/category, min 3 images, safety rules (never AUTHENTICATED < 70%)
- NOT wired to any server action — exists as standalone utility

### Tests (138 existing)
- authentication-ai.test.ts: 19 tests
- authentication-complete-ai.test.ts: 12 tests
- authentication-complete.test.ts: 11 tests
- authentication.test.ts: 10 tests
- auth-notifier.test.ts: 12 tests
- constants.test.ts: 15 tests
- cost-split.test.ts: 18 tests
- entrupy-provider.test.ts: 10 tests
- phash.test.ts: 15 tests
- ai-webhook-notify.test.ts: 7 tests
- ai-webhook.test.ts: 9 tests

## Identified Gaps (What G10.2 Still Needs)

### GAP 1: Entrupy webhook secret reads from env var, NOT platform_settings
- `entrupy-provider.ts` line 100-103: reads `process.env['AI_PROVIDER_WEBHOOK_SECRET']`
- Should read from `getPlatformSetting<string>(AUTH_SETTINGS_KEYS.AI_PROVIDER_WEBHOOK_SECRET, '')`
- The setting IS seeded but NOT consumed

### GAP 2: No ledger entry for authentication fees
- Feature Lock-in Addendum #48 says "settled within the transaction, never deferred"
- Decision #39 says "seller's $9.99 share is deducted from item proceeds before payout"
- No code posts AUTHENTICATION_FEE ledger entries
- The webhook route and completeAuthentication set buyerFeeCents/sellerFeeCents but never post to ledger

### GAP 3: No BullMQ timeout job for stale AI_PENDING requests
- `trust.authentication.aiMaxTurnaroundHours` seeded (24h) but never consumed
- If Entrupy never calls back, requests stay AI_PENDING forever
- Need a cron/scheduled job to mark stale requests as AI_INCONCLUSIVE after max turnaround

### GAP 4: AI_AUTHENTICATED badge on listing detail lacks verify link
- `AuthenticationBadge` for AI_AUTHENTICATED status does NOT link to /verify/[certNumber]
- Expert AUTHENTICATED badge DOES link. AI should too (certificate exists).

### GAP 5: packages/ai authentication NOT integrated with Entrupy flow
- In-house Claude Vision (packages/ai) could serve as fallback or supplementary check
- Currently orphaned. Decision needed: wire as secondary check or leave as standalone.

### GAP 6: Checkout auth offer for AI tier
- `auth-offer-check.ts` exists and reads threshold. Checkout shows auth option for $500+ items.
- But it points to Expert auth flow ($39.99). Should also offer AI auth ($19.99) as cheaper option when aiEnabled=true.

### GAP 7: Seller cannot view detailed AI results
- Authentication page shows status badge only (pending/authenticated/counterfeit)
- No display of resultNotes, confidence %, detail checks, or AI findings
- Seller should see result details (especially on INCONCLUSIVE for retry decision)

### GAP 8: Missing category validation on request submission
- `trust.authentication.aiSupportedCategories` is seeded but never checked in `requestAiAuthentication`
- The action submits to Entrupy regardless of category
- The `packages/ai` version DOES check categories, but the action uses Entrupy provider directly

### GAP 9: Admin hub page for managing authentication requests
- No hub page for staff to view/manage all authentication requests platform-wide
- `completeAuthentication` action requires staff access but has no UI to drive it
- The webhook handles automatic completion. Staff manual completion needs a UI.

## Spec Inconsistencies
1. Feature Lock-in Addendum says AI auth cost is "$19.99" but also says buyer-initiated is "$9.99 at checkout" (that's the buyer SHARE of Tier 2, not the total). The total is $19.99, buyer share is $9.99, seller share is $9.99. Seeds confirm: aiFeeCents=1999, buyerFeeCents=1999, sellerFeeCents=1999. But buyerFeeCents/sellerFeeCents are the per-party shares IF authenticated — they equal the total NOT half. Actually looking at the cost-split logic: totalFeeCents is used as the input, then split 50/50. So total=$19.99, each share=$9.99 on authentic. Seeds are correct.

2. `packages/ai` feature uses `ai.authentication.enabled` as kill switch key. The server action uses `trust.authentication.aiEnabled`. Two different kill switch keys for two different systems — intentional (one is the in-house AI feature gate, other is the Entrupy integration gate).
