# G10.12 Newsletter Subscribe Form — Research Findings

## Key Discovery: MAJOR SPEC GAP

`newsletter_subscriber` table DOES NOT EXIST in schema v2.1.0. The table inventory ends at §23.2 (buyer_referral).
No API route for newsletter subscribe exists in Page Registry v1.8.
No CASL subject for newsletter subscription exists in Actors/Security Canonical.
The Build Sequence Tracker entry says only: "V2 homepage has email capture form. V3 has no newsletter subscription."

This is the most under-specified G10 feature. The prompt must explicitly request 5 owner decisions.

## What the Specs DO Say

### Feature Lock-in §27 — Marketing Opt-In
- Marketing emails require explicit opt-in (checkbox during signup, unchecked by default)
- Separate from transactional notifications
- One-click unsubscribe from marketing in every marketing email
- Setting: `notifications.marketingOptInRequired: true`

### Actors/Security Canonical §10.1 — Email Security
- `List-Unsubscribe` header on ALL marketing email
- Bounce handling: disable email for hard bounces
- DMARC, DKIM, SPF required

### Platform Settings Canonical §12.1 — Comms/Email
- `comms.email.marketingEnabled: boolean` (true) — enable marketing email campaigns
- `comms.email.marketingOptInRequired: boolean` (true) — require explicit opt-in

### Buyer Acquisition Addendum §11 — Explicitly Out of Scope
"Email marketing to acquired buyers — covered by notification/personalization systems already spec'd."
This says newsletter marketing for EXISTING users = notification system. But the V2 form captures
GUEST emails (pre-signup) — that's a different use case.

## Owner Decisions Required (5)

1. **DB approach**: Add `newsletter_subscriber` table to schema (new §23.3) OR store in `user.marketingOptIn` column only (for logged-in users, not guests). Guest capture requires a new table.
2. **Unsubscribe mechanism**: HMAC-signed token in URL (like most ESPs) OR DB token column.
3. **Confirmation email**: Single opt-in (subscribe immediately) vs double opt-in (confirm via email first). GDPR/CAN-SPAM compliance may require double opt-in depending on audience.
4. **Rate limiting**: What rate limit for the POST /api/newsletter/subscribe endpoint? (No Valkey/BullMQ pattern exists yet for anonymous rate-limiting on API routes.)
5. **Welcome email**: Send a welcome email immediately on subscribe, or just store the email?

## Existing Infrastructure

### Email
- `src/lib/email/send.ts` — `sendEmail({ to, subject, react })` using Resend
- `src/lib/email/templates/` — 29 existing React Email templates
- Pattern: `Html + Head + Body + Container + Heading + Text + Button + Hr` from `@react-email/components`
- From address: `Twicely <noreply@twicely.co>`

### Homepage
- `src/app/(marketplace)/page.tsx` — 220 lines (has room for +30 lines, but form goes as child component)
- `src/components/shared/marketplace-footer.tsx` — 73 lines (good place for newsletter form)
- `src/components/pages/home/home-tabs.tsx` — 115 lines

### Platform Settings
- Extended settings in `v32-platform-settings-extended.ts`
- Setting type `'boolean'` for `comms.email.marketingEnabled`

## Recommended Architecture (for prompt)

Given the spec gap, the prompt should flag all owner decisions and recommend:

1. New `newsletter_subscriber` table in `src/lib/db/schema/acquisition.ts` (§23.3)
   - id (CUID2 PK), email (unique), source ('HOMEPAGE_FOOTER' | 'HOMEPAGE_SECTION'), confirmedAt (nullable for double opt-in), unsubscribeToken (HMAC or random), subscribedAt, unsubscribedAt
2. POST `/api/newsletter/subscribe` — public, Zod-validated email, rate-limit 5/hour/IP (without Valkey, use simple counter in DB or skip rate-limit and flag)
3. GET `/api/newsletter/unsubscribe?token=xxx` — public, validates token, sets unsubscribedAt
4. Form component: `src/components/shared/newsletter-signup.tsx` — 'use client', email input + submit button
5. Welcome email template: `src/lib/email/templates/newsletter-welcome.tsx`
6. Placement: BOTH homepage section (below tabs) AND footer (replace copyright row or add above it)
7. 2 new platform settings: `newsletter.enabled` (boolean), `newsletter.doubleOptIn` (boolean)

## Files Expected

### New Files
- `src/lib/db/schema/newsletter.ts` — newsletter_subscriber table (separate file, not adding to acquisition.ts which is at its limit conceptually)
- `src/app/api/newsletter/subscribe/route.ts` — POST handler
- `src/app/api/newsletter/unsubscribe/route.ts` — GET handler
- `src/components/shared/newsletter-signup.tsx` — 'use client' form component
- `src/lib/email/templates/newsletter-welcome.tsx` — React Email template
- `src/lib/actions/__tests__/newsletter.test.ts` — unit tests
- `src/lib/db/schema/__tests__/newsletter.test.ts` — schema test

### Modified Files
- `src/lib/db/schema/index.ts` — export newsletter table
- `src/lib/db/seed/v32-platform-settings-extended.ts` — add newsletter settings
- `src/components/shared/marketplace-footer.tsx` — add NewsletterSignup (optional, per owner decision)
- `src/app/(marketplace)/page.tsx` — add NewsletterSignup section (optional, per owner decision)

## Homepage Line Count (at prompt write)
- page.tsx: 220 lines (has room)
- marketplace-footer.tsx: 73 lines (has room)

## Test Estimate
~20-25 new tests (API route: 12, schema: 3, component: 5-6, email template: 3)
