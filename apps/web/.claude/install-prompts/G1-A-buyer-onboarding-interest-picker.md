# [G1-A] Buyer Onboarding — Post-Signup Interest Picker

**Phase & Step:** G1-A (first slice of G1 "Onboarding Flows")
**Feature Name:** Buyer Interest Picker Onboarding
**One-line Summary:** Build the `/auth/onboarding` page where new users select 2+ interest tags from a visual grid, saving selections to `userInterest` with source=EXPLICIT and weight=10.0.

**Canonical Sources (read ALL before starting):**
1. `TWICELY_V3_PERSONALIZATION_CANONICAL.md` -- Section 4 (Onboarding Picker), Section 3 (Interest Tags), Section 5 (Signal Weights), Section 6 (Weight/Decay)
2. `TWICELY_V3_PAGE_REGISTRY.md` -- Route #22: `/auth/onboarding`
3. `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` -- Section 13 "Onboarding Flows" > Buyer First-Run
4. `TWICELY_V3_SCHEMA_v2_1_0.md` -- Section 22.1 (`interestTag`), Section 22.2 (`userInterest`)
5. `Build-docs/TWICELY_V3_SCHEMA_ADDENDUM_v1_4.md` -- Signal weight table (EXPLICIT = 10.0, expiresAt = NULL)
6. `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` -- Section 3.2 (Buyer permissions: can update own User)
7. `CLAUDE.md` -- All build rules

---

## 1. PREREQUISITES

**Completed phases required:** A through F (all complete).

**Tables that must already exist:**
- `interestTag` -- exists in `src/lib/db/schema/personalization.ts` (8 seed tags, extensible)
- `userInterest` -- exists in `src/lib/db/schema/personalization.ts` (unique constraint on userId+tagSlug+source)
- `user` -- exists in `src/lib/db/schema/auth.ts`
- `interestSourceEnum` -- exists in `src/lib/db/schema/enums.ts` (includes 'EXPLICIT')

**Infrastructure already in place:**
- Better Auth configured in `src/lib/auth/server.ts` (email+password, requireEmailVerification)
- CASL authorize in `src/lib/casl/authorize.ts`
- Existing action pattern: `'use server'`, Zod `.strict()`, `authorize()`, explicit field mapping
- Auth layout at `src/app/auth/layout.tsx` (centered card on gray background)
- Seed data for 8 interest tags in `src/lib/db/seed/seed-personalization.ts`

**No new npm packages needed.** Everything uses existing shadcn/ui + Tailwind.

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

### 2.1 Database Changes

**No new tables.** Both `interestTag` and `userInterest` already exist.

**Seed data expansion:** The Personalization Canonical Section 3 specifies 30+ seed tags across 5 groups. Currently only 8 are seeded. This step expands the seed to the full set. The spec lists:

| Group | Tags |
|-------|------|
| fashion | Streetwear, Vintage Fashion, Designer, Y2K, Activewear, Sustainable Fashion, Plus Size, Luxury (fashion), Kids & Baby Fashion, Denim, Outerwear |
| electronics | Smartphones, Gaming Hardware, Audio, Cameras, Computers, Smart Home, Wearable Tech |
| home | Home Decor, Kitchen, Outdoor & Garden, Furniture, Vintage Home |
| collectibles | Trading Cards, Vinyl Records, Sneaker Collecting, Watches, Art, Coins & Currency, Sports Memorabilia, Funko & Figures |
| lifestyle | Books, Fitness, Beauty, Musical Instruments, Crafts & DIY |

Each tag needs: `id` (hardcoded for idempotency), `slug`, `label`, `group`, `imageUrl` (null for now -- placeholder), `cardEmphasis` (fashion=social, electronics=specs, collectibles=collectible, home/lifestyle=default), `displayOrder`, `isActive: true`.

**IMPORTANT:** The existing 8 seed tags (vintage, sneakers, electronics, designer, home-decor, gaming, outdoor, luxury) must remain unchanged. Only ADD new tags. Existing seed userInterest records reference existing tag slugs -- do not break them.

### 2.2 Server Action: `saveUserInterests`

**File:** `src/lib/actions/personalization.ts`

**Behavior:**
1. Accept an array of tag slugs.
2. Validate with Zod: `z.object({ tagSlugs: z.array(z.string().min(1).max(50)).min(2) }).strict()`
3. Call `authorize()` -- require authenticated session (session !== null).
4. CASL check: `ability.can('update', sub('User', { id: session.userId }))`.
5. Delete all existing EXPLICIT source rows for this userId from `userInterest`.
6. Insert one row per selected tag slug with:
   - `userId`: session.userId
   - `tagSlug`: the slug
   - `weight`: '10.0' (from Personalization Canonical Section 5/6 signal table)
   - `source`: 'EXPLICIT'
   - `expiresAt`: null (EXPLICIT picks never expire -- Section 6)
7. Use a transaction wrapping the delete + inserts for atomicity.
8. `revalidatePath('/')` (homepage feed will use interests).
9. Return `{ success: true, count: tagSlugs.length }`.

**Edge cases:**
- If user submits slugs that don't exist in `interestTag`, silently filter them out (validate against DB).
- If after filtering fewer than 2 valid slugs remain, return error.
- This action is idempotent -- calling it again replaces all EXPLICIT interests.
- Behavioral signals (PURCHASE, WATCHLIST, CLICK, SEARCH) are NOT deleted -- only EXPLICIT.

### 2.3 Server Action: `skipOnboarding`

**File:** Same `src/lib/actions/personalization.ts`

**Behavior:**
1. No input needed.
2. Call `authorize()` -- require authenticated session.
3. Record that the user skipped by doing nothing to `userInterest` (no rows created).
4. The "has completed onboarding" state is derived: if user has ANY `userInterest` rows with source=EXPLICIT, they've done the picker. If they have zero EXPLICIT rows, they either skipped or haven't seen it yet. The distinction doesn't matter for the app -- both cases get the generic Explore feed.
5. Return `{ success: true }`.

**NOTE:** There is no `onboardingCompletedAt` column on the `user` table in the schema doc. Do NOT add one. The absence of EXPLICIT interests is the signal.

**OWNER DECISION NEEDED:** The Personalization Canonical Section 4 says "Settings page shows 'You haven't picked any interests yet -- want to personalize your feed?'" for users who skipped. This implies we need a way to know whether the user WAS SHOWN the picker (and chose to skip) vs. never saw it (e.g., logged in from before this feature existed). The simplest approach: check if user was created AFTER the feature shipped. But this is a Phase G polish concern. For now, assume: if the user has zero EXPLICIT userInterest rows, show the suggestion on the settings page. This does not require any DB change.

### 2.4 Query: `getInterestTags`

**File:** `src/lib/queries/personalization.ts`

**Behavior:**
1. Fetch all active interest tags from `interestTag` where `isActive = true`, ordered by `group` then `displayOrder`.
2. Group results by `group` field and return as `Record<string, InterestTagRow[]>`.
3. No auth required for this query (the tags are platform data, not user-specific).

### 2.5 Query: `getUserExplicitInterests`

**File:** Same `src/lib/queries/personalization.ts`

**Behavior:**
1. Accept `userId: string`.
2. Fetch all `userInterest` rows where `userId = $1 AND source = 'EXPLICIT'`.
3. Return array of `{ tagSlug: string }`.
4. Used by the onboarding page to pre-select interests if user returns to the picker.

### 2.6 Page: `/auth/onboarding`

**Route:** `src/app/auth/onboarding/page.tsx` (server component)
**Layout:** Uses existing auth layout at `src/app/auth/layout.tsx`
**Gate:** AUTH (any authenticated user). Redirect to `/auth/login` if not authenticated.
**Title:** "Welcome to Twicely" (from Page Registry #22)
**Build Phase:** G1

**Server component behavior:**
1. Call `authorize()`. If `session` is null, `redirect('/auth/login')`.
2. Call `getUserExplicitInterests(session.userId)`. If user already has 2+ EXPLICIT interests, redirect to `/` (they've already completed onboarding).
3. Call `getInterestTags()` to get all active tags grouped by category.
4. Pass tags + any existing selections to client component.

**IMPORTANT -- Auth Layout Modification:** The current auth layout constrains content to `max-w-md` (448px). The interest picker is a full-screen visual grid and needs more space. The onboarding page should **opt out of the auth layout constraint** by using its own layout. Create `src/app/auth/onboarding/layout.tsx` that provides a full-screen centered layout without the `max-w-md` constraint but keeps the same `min-h-screen bg-gray-50` styling.

### 2.7 Client Component: `InterestPicker`

**File:** `src/components/onboarding/interest-picker.tsx` (client component)

**Design spec from Personalization Canonical Section 4:**
- Full-screen visual grid.
- NOT checkboxes. Large lifestyle images with short labels.
- Tap to select (highlight with brand purple border), tap again to deselect.
- Prompt: "What brings you to Twicely?"
- Minimum: 2 selections (Submit button disabled until 2+ selected)
- Maximum: No limit
- Target time: 10 seconds (keep UI simple, fast)
- Skippable: Yes -- "Skip for now" link at bottom

**Layout:**
- Heading: "What brings you to Twicely?"
- Subheading: "Pick at least 2 interests to personalize your experience."
- Interest tags displayed as a responsive grid of cards.
- Each card: the tag's `imageUrl` (or a placeholder gradient if null) + label text overlay.
- Cards grouped by category with category name as section header.
- Selected cards: purple border (use `ring-2 ring-primary` or `border-2 border-primary`) + subtle scale transform or checkmark overlay.
- Unselected cards: neutral border, slightly muted.
- Bottom area: "Continue" button (primary, disabled until 2+ selected, shows count: "Continue (3 selected)") + "Skip for now" text link.

**Interactions:**
- Click/tap on card toggles selection state (optimistic UI, no server call per toggle).
- "Continue" button calls `saveUserInterests({ tagSlugs: selectedSlugs })`.
- On success, `router.push('/')` to go to homepage.
- On error, show toast/error message.
- "Skip for now" calls `skipOnboarding()` then `router.push('/')`.
- Loading state on Continue button while saving.

**Responsive:**
- Mobile (< 640px): 2-column grid
- Tablet (640-1024px): 3-column grid
- Desktop (> 1024px): 4-column grid
- Cards should be approximately square with image background and text overlay at bottom.

### 2.8 Redirect Wiring

**Current flow:** Signup page -> `/auth/verify-email?email=...` -> user clicks email link -> Better Auth verifies -> user must log in.

**New flow:** After login, if user has zero EXPLICIT interests AND was created recently (within last 30 minutes, to avoid sending existing users to onboarding), redirect to `/auth/onboarding`.

**Implementation approach:** Modify the signup page's redirect. After successful signup, the page redirects to `/auth/verify-email?email=...&new=1`. This `new=1` param doesn't change verify-email behavior. The login page already accepts a `callbackUrl` query param. After email verification, when the user clicks "Back to Sign In" on verify-email or uses the verification link that logs them in, they arrive at login. Modify the signup page to set a localStorage flag `twicely_new_signup=1` on successful signup. Then modify the login page: after successful login, check for this flag. If present, redirect to `/auth/onboarding` instead of `/my`, and clear the flag.

**Alternative approach (simpler, recommended):** Just modify the signup page redirect. After signup, redirect to `/auth/verify-email?redirect=/auth/onboarding`. The verify-email page passes this along. When user verifies and logs in, the callbackUrl is `/auth/onboarding`. The onboarding page server component handles the "already completed" redirect.

**BUT:** Better Auth's email verification flow controls the redirect after token verification. The verify-email page is just informational ("check your email"). The actual verification happens when the user clicks the link in the email, which Better Auth processes at `/api/auth/verify-email?token=...`. Better Auth then redirects to `/` or a configured URL.

**Simplest correct approach:** Configure Better Auth's `emailVerification.autoSignInAfterVerification` to redirect to `/auth/onboarding`. OR: In the signup page, after successful signup, pass `callbackUrl=/auth/onboarding` to the verify-email page. Then update the verify-email page's "Back to Sign In" link to include `?callbackUrl=/auth/onboarding`. When the user logs in from there, they'll be redirected to `/auth/onboarding`.

**OWNER DECISION NEEDED:** Better Auth's email verification redirect behavior needs to be checked. The safest approach with no Better Auth config changes:
1. Signup page redirects to `/auth/verify-email?email=...` (unchanged).
2. On the verify-email page, change "Back to Sign In" link to include `?callbackUrl=/auth/onboarding`.
3. Better Auth verifies email when user clicks link. User still needs to log in.
4. User returns to login. The callbackUrl param sends them to `/auth/onboarding` after login.
5. Onboarding page's server component checks: if already has 2+ EXPLICIT interests, redirect to `/`.
6. Returning users who log in normally (not from verify-email) go to `/my` as usual.

This approach is non-invasive. It only changes the verify-email page's link. No Better Auth config changes.

**For existing users:** They never see the onboarding page unless they manually navigate to `/auth/onboarding`. That page will work fine -- they can pick interests or be redirected home if they already have some.

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Banned Terms
- Do NOT use `wallet`, `balance`, `withdraw` anywhere
- Do NOT use `SellerTier`, `SubscriptionTier`, `FVF`, `BASIC`, `ELITE`, `PREMIUM`
- None of these are likely for this feature, but scan output before committing

### Technology
- Do NOT use Zustand/Redux for picker state -- use React `useState`
- Do NOT add any new npm packages
- Do NOT use `as any`, `@ts-ignore`, `@ts-expect-error`

### Business Logic
- Do NOT filter interest tags by user's seller status -- ALL users see ALL tags
- Do NOT require seller status to use the picker -- any authenticated user can pick interests
- Do NOT create a new column on the `user` table (no `onboardingCompletedAt` or similar)
- Do NOT modify the `interestTag` or `userInterest` schema files -- they are correct as-is
- Do NOT delete behavioral signals (PURCHASE, WATCHLIST, CLICK, SEARCH) when saving explicit interests
- EXPLICIT weight is 10.0 (from spec), expiresAt is NULL (from spec) -- do not use different values
- Do NOT add a CASL subject for `UserInterest` -- use `User` subject with own-user condition

### Code Patterns
- Max 300 lines per file
- Zod `.strict()` on all input schemas
- Explicit field mapping in inserts (never spread)
- `userId` from session, never from request body
- Helpers in `'use server'` files must NOT be exported (to avoid unintended server actions)

### Route
- The page is at `/auth/onboarding` (NOT `/my/onboarding`, NOT `/onboarding`)
- Do NOT create routes at `/my/settings/interests` in this slice (that's a separate G1 slice)

---

## 4. ACCEPTANCE CRITERIA

### Functional
- [ ] Navigating to `/auth/onboarding` while unauthenticated redirects to `/auth/login`
- [ ] Navigating to `/auth/onboarding` while authenticated shows the interest picker
- [ ] Interest tags are displayed in a visual grid grouped by category (fashion, electronics, home, collectibles, lifestyle)
- [ ] Clicking a tag toggles its selection state visually (purple border)
- [ ] "Continue" button is disabled when fewer than 2 tags are selected
- [ ] "Continue" button shows selected count (e.g., "Continue (3 selected)")
- [ ] Clicking "Continue" with 2+ tags saves all selections to `userInterest` with source=EXPLICIT, weight=10.0, expiresAt=NULL
- [ ] After saving, user is redirected to homepage (`/`)
- [ ] Clicking "Skip for now" redirects to homepage without saving any interests
- [ ] If user already has 2+ EXPLICIT interests and visits `/auth/onboarding`, they are redirected to `/`
- [ ] If user returns to the picker, any existing EXPLICIT selections are pre-checked
- [ ] Saving new interests replaces ALL previous EXPLICIT interests (delete + insert in transaction)
- [ ] Behavioral signals (PURCHASE, WATCHLIST, CLICK, SEARCH) are NOT deleted when saving
- [ ] Verify-email page's "Back to Sign In" link includes `?callbackUrl=/auth/onboarding`
- [ ] The full set of 30+ interest tags is seeded (not just the original 8)

### Authorization
- [ ] `saveUserInterests` requires authenticated session
- [ ] `saveUserInterests` checks `ability.can('update', sub('User', { id: session.userId }))`
- [ ] `skipOnboarding` requires authenticated session
- [ ] `getInterestTags` works without authentication (it returns platform data)
- [ ] userId is derived from session, never from request body

### Data Integrity
- [ ] `userInterest` rows created with source='EXPLICIT' have weight='10.0' and expiresAt=NULL
- [ ] The unique constraint (userId, tagSlug, source) prevents duplicate EXPLICIT rows for same tag
- [ ] Transaction wraps delete + insert so partial saves cannot occur
- [ ] Invalid/nonexistent tag slugs are filtered out before insert

### UI/UX
- [ ] Responsive grid: 2 cols mobile, 3 cols tablet, 4 cols desktop
- [ ] Selected state uses brand purple (primary color) border/ring
- [ ] "Skip for now" is a text link, not a button (lower visual weight)
- [ ] Page title is "Welcome to Twicely"
- [ ] Heading is "What brings you to Twicely?"
- [ ] No blocked rendering -- page loads fast with all tags visible

### Vocabulary
- [ ] No banned terms appear in any created/modified file

---

## 5. TEST REQUIREMENTS

### Unit Tests: `src/lib/actions/__tests__/personalization.test.ts`

**Mock pattern:** Follow existing pattern from `price-alerts.test.ts`:
- Mock `@/lib/db` with `{ db: mockDb }`
- Mock `@/lib/casl` with `{ authorize: mockAuthorize, sub: vi.fn() }`
- Mock `next/cache` with `{ revalidatePath: vi.fn() }`

**Test cases for `saveUserInterests`:**

1. `returns error when no session` -- mockAuthorize returns null session. Expect `{ success: false, error: ... }`.
2. `returns error when CASL denies update` -- session exists but ability.can returns false. Expect `{ success: false, error: 'Forbidden' }`.
3. `returns error when fewer than 2 tag slugs` -- valid session, pass 1 tag slug. Expect Zod validation error.
4. `returns error when tagSlugs is empty array` -- valid session, pass empty array. Expect Zod validation error.
5. `rejects unknown keys in input` -- pass `{ tagSlugs: ['a','b'], extraField: true }`. Expect error (Zod strict).
6. `saves interests with correct weight and source` -- valid session, pass 3 valid slugs. Verify:
   - Existing EXPLICIT rows for user are deleted
   - 3 new rows inserted with source='EXPLICIT', weight='10.0', expiresAt=null
   - `revalidatePath('/')` called
   - Returns `{ success: true, count: 3 }`
7. `filters out invalid tag slugs` -- pass 3 slugs, 1 doesn't exist in DB. Verify only 2 valid ones are inserted.
8. `returns error if fewer than 2 valid slugs after filtering` -- pass 2 slugs, 1 invalid. After filtering only 1 remains. Expect error.
9. `does NOT delete behavioral signals` -- user has PURCHASE and EXPLICIT rows. After save, verify delete only targets source='EXPLICIT'.

**Test cases for `skipOnboarding`:**

10. `returns error when no session` -- Expect `{ success: false, error: ... }`.
11. `returns success when authenticated` -- Expect `{ success: true }`.

**Test cases for `getInterestTags` (query):** `src/lib/queries/__tests__/personalization.test.ts`

12. `returns tags grouped by category` -- Mock DB to return tags from multiple groups. Verify result is `Record<string, tag[]>`.
13. `excludes inactive tags` -- Include an `isActive: false` tag in mock data. Verify it's not in results.
14. `returns empty object when no tags exist` -- Mock empty result. Verify `{}`.

**Test cases for `getUserExplicitInterests` (query):**

15. `returns only EXPLICIT source interests for given user` -- Mock DB with mixed sources. Verify only EXPLICIT returned.
16. `returns empty array when user has no explicit interests` -- Verify `[]`.

Target: ~16 tests minimum.

### Integration Considerations (informational, not required for this slice)
- Full E2E: signup -> verify -> login -> see onboarding -> pick interests -> land on homepage with personalized feed.
- This requires the feed query (Phase G later slice) to be functional to verify end-to-end.

---

## 6. FILE APPROVAL LIST

**New files to CREATE:**

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/app/auth/onboarding/layout.tsx` | Full-screen layout override (no max-w-md constraint) |
| 2 | `src/app/auth/onboarding/page.tsx` | Server component: auth gate, fetch tags, render picker |
| 3 | `src/components/onboarding/interest-picker.tsx` | Client component: visual grid, tap-to-select, submit/skip |
| 4 | `src/lib/actions/personalization.ts` | Server actions: saveUserInterests, skipOnboarding |
| 5 | `src/lib/queries/personalization.ts` | Queries: getInterestTags, getUserExplicitInterests |
| 6 | `src/lib/validations/personalization.ts` | Zod schemas: saveUserInterestsSchema |
| 7 | `src/lib/actions/__tests__/personalization.test.ts` | Tests for saveUserInterests, skipOnboarding |
| 8 | `src/lib/queries/__tests__/personalization.test.ts` | Tests for getInterestTags, getUserExplicitInterests |

**Existing files to MODIFY:**

| # | File Path | Change Description |
|---|-----------|-------------------|
| 9 | `src/lib/db/seed/seed-personalization.ts` | Expand from 8 to 30+ interest tags (add new, keep existing) |
| 10 | `src/app/auth/verify-email/page.tsx` | Change "Back to Sign In" link to `/auth/login?callbackUrl=/auth/onboarding` |

**Files NOT modified:**
- `src/lib/db/schema/personalization.ts` -- already correct
- `src/lib/db/schema/enums.ts` -- already has interestSourceEnum with EXPLICIT
- `src/lib/db/schema/auth.ts` -- no new columns
- `src/lib/casl/subjects.ts` -- no new subject needed (use User)
- `src/lib/casl/ability.ts` -- no new rules needed (User update already exists)
- `src/lib/auth/server.ts` -- no config changes
- `src/app/auth/layout.tsx` -- unchanged (onboarding has its own layout override)

---

## 7. IMPLEMENTATION DETAILS PER FILE

### File 1: `src/app/auth/onboarding/layout.tsx` (~15 lines)

```
export default function OnboardingLayout({ children }) {
  // Full-screen centered, no max-w-md
  // min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-8
}
```

This nested layout overrides the auth layout's `max-w-md` constraint. The auth layout wraps with `min-h-screen flex items-center justify-center bg-gray-50 > max-w-md`. This nested layout should provide its own max-width (e.g., `max-w-4xl` for the grid).

### File 2: `src/app/auth/onboarding/page.tsx` (~40 lines)

Server component:
1. `const { session } = await authorize();`
2. If `!session`, `redirect('/auth/login');`
3. `const existing = await getUserExplicitInterests(session.userId);`
4. If `existing.length >= 2`, `redirect('/');` -- already completed
5. `const tagsByGroup = await getInterestTags();`
6. Extract pre-selected slugs from `existing`.
7. Render `<InterestPicker tagsByGroup={tagsByGroup} preSelected={selectedSlugs} />`

Metadata: `export const metadata = { title: 'Welcome to Twicely' };`

### File 3: `src/components/onboarding/interest-picker.tsx` (~200 lines)

Client component with:
- Props: `tagsByGroup: Record<string, Tag[]>`, `preSelected: string[]`
- State: `selectedSlugs: Set<string>` (initialized from preSelected)
- State: `isSubmitting: boolean`
- State: `error: string | null`

Render:
- Heading section
- For each group, a section header + grid of cards
- Each card is a button with the tag image/gradient + label
- Selected cards get `ring-2 ring-primary` + scale effect
- Bottom: Continue button + Skip link

The GROUP_LABELS map: `{ fashion: 'Fashion', electronics: 'Electronics', home: 'Home', collectibles: 'Collectibles', lifestyle: 'Lifestyle' }`.

GROUP_ORDER: `['fashion', 'electronics', 'collectibles', 'home', 'lifestyle']` (fashion first since it's likely the biggest interest on a resale platform).

### File 4: `src/lib/actions/personalization.ts` (~80 lines)

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { userInterest, interestTag } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { authorize, sub } from '@/lib/casl';
import { saveUserInterestsSchema } from '@/lib/validations/personalization';

// Action result type (unexported to avoid unintended server action)
interface ActionResult {
  success: boolean;
  count?: number;
  error?: string;
}

export async function saveUserInterests(input: { tagSlugs: string[] }): Promise<ActionResult> {
  // 1. Validate
  // 2. Authorize
  // 3. Verify slugs exist in DB
  // 4. Transaction: delete old EXPLICIT + insert new
  // 5. revalidatePath('/')
  // 6. Return result
}

export async function skipOnboarding(): Promise<ActionResult> {
  // 1. Authorize
  // 2. Return success (no-op)
}
```

### File 5: `src/lib/queries/personalization.ts` (~60 lines)

```typescript
import { db } from '@/lib/db';
import { interestTag, userInterest } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export async function getInterestTags(): Promise<Record<string, InterestTagRow[]>> {
  // SELECT * FROM interest_tag WHERE is_active = true ORDER BY group, display_order
  // Group results into Record<string, rows[]>
}

export async function getUserExplicitInterests(userId: string): Promise<{ tagSlug: string }[]> {
  // SELECT tag_slug FROM user_interest WHERE user_id = $1 AND source = 'EXPLICIT'
}
```

### File 6: `src/lib/validations/personalization.ts` (~15 lines)

```typescript
import { z } from 'zod';

export const saveUserInterestsSchema = z.object({
  tagSlugs: z.array(z.string().min(1).max(50)).min(2, 'Select at least 2 interests'),
}).strict();
```

### File 9: `src/lib/db/seed/seed-personalization.ts` (expand)

Add ~25 new TAG_IDS entries (keeping existing 8). Update the `db.insert(interestTag).values([...])` call to include all 30+ tags. Use `onConflictDoNothing()` (already present).

**Slug convention:** lowercase, hyphenated. E.g., `'vintage-fashion'`, `'gaming-hardware'`, `'trading-cards'`, `'smart-home'`, `'crafts-diy'`.

**CardEmphasis mapping:**
- fashion group -> 'social'
- electronics group -> 'specs'
- collectibles group -> 'collectible'
- home group -> 'default'
- lifestyle group -> 'default'

Existing tags (vintage, sneakers, designer) have group=fashion. If adding `'vintage-fashion'` as a separate tag from `'vintage'`, use a distinct slug. Review existing slugs to avoid conflicts:
- Existing: vintage, sneakers, electronics, designer, home-decor, gaming, outdoor, luxury
- The spec says "Vintage Fashion" -- this overlaps with existing `vintage`. Keep `vintage` as-is (it's already fashion group). Add the new tags that don't overlap.

**Resolve overlap:** The existing seed tag `vintage` (label: "Vintage", group: "fashion") maps to the spec's "Vintage Fashion". The existing `sneakers` maps to both "Sneakers" (fashion) and "Sneaker Collecting" (collectibles). Keep existing tags, add non-overlapping ones. Where the spec lists both "Sneakers" (fashion) and "Sneaker Collecting" (collectibles), the existing `sneakers` covers the fashion side; add `sneaker-collecting` for collectibles.

### File 10: `src/app/auth/verify-email/page.tsx` (modify)

Change the "Back to Sign In" link from:
```tsx
<Link href="/auth/login" ...>Back to Sign In</Link>
```
To:
```tsx
<Link href="/auth/login?callbackUrl=%2Fauth%2Fonboarding" ...>Back to Sign In</Link>
```

This sends new users through the onboarding flow after they verify email and log in. Existing users who log in directly skip onboarding (they go to `/my`).

---

## 8. VERIFICATION CHECKLIST

After implementation, run:

```bash
./twicely-lint.sh
```

Paste the FULL raw output. Additionally verify:

| Check | Command / Method | Expected |
|-------|-----------------|----------|
| TypeScript | `pnpm typecheck` | 0 errors |
| Tests | `pnpm test` | >= 3531 (current baseline) + ~16 new tests |
| Banned terms | Part of twicely-lint.sh | 0 occurrences |
| File sizes | Part of twicely-lint.sh | All files under 300 lines |
| Route check | Part of twicely-lint.sh | No banned route patterns |
| Console.log | Part of twicely-lint.sh | 0 occurrences in new files |
| Page loads | Visit `/auth/onboarding` while logged in | See interest picker grid |
| Page loads | Visit `/auth/onboarding` while logged out | Redirect to `/auth/login` |
| Seed runs | Verify seed-personalization runs without errors | 30+ tags in DB |

---

## 9. SPEC TENSIONS & DECISIONS

### Tension 1: Page vs Overlay
**Personalization Canonical Section 4 Route:** "For buyers, shown on first homepage visit after signup as an interstitial overlay (not a separate page -- dismissable)."
**Page Registry #22:** `/auth/onboarding` as a separate page with `auth` layout, gate=AUTH, build phase=G1.

**Resolution:** Use `/auth/onboarding` as a separate page (Page Registry is the route authority). The Personalization Canonical's "interstitial overlay" was a design preference, but the Page Registry explicitly specifies a distinct route. The redirect flow (signup -> verify -> login -> onboarding -> homepage) provides the same seamless experience.

### Tension 2: "3-5 categories" vs "2+ interests"
**Feature Lock-in Section 13:** "select 3-5 categories"
**Personalization Canonical Section 4:** "Minimum: 2 selections, Maximum: No limit"

**Resolution:** Use the Personalization Canonical (minimum 2, no max). It's the more detailed spec and the one specifically about this feature. Feature Lock-in Section 13 is a summary.

### Tension 3: Interest Tags vs Categories
**Feature Lock-in Section 13:** "select 3-5 categories"
**Personalization Canonical Section 3-4:** Interest tags, which cross-cut categories

**Resolution:** The picker shows interest tags, not categories. Interest tags are the correct abstraction per the Personalization Canonical. The Feature Lock-in used "categories" loosely.

---

## 10. NOTES FOR SPEC-COMPLIANCE-REVIEWER

When reviewing the implementation of this prompt, check:

1. **Weight value:** Every EXPLICIT userInterest row must have weight='10.0' (not 1.0, not any other value).
2. **ExpiresAt:** Every EXPLICIT userInterest row must have expiresAt=NULL (never expires).
3. **Source:** Must be 'EXPLICIT' (not 'ONBOARDING' or any custom value).
4. **Transaction:** The delete + insert must be wrapped in a Drizzle transaction.
5. **Behavioral preservation:** `saveUserInterests` must NOT delete rows where source != 'EXPLICIT'.
6. **Auth check:** `authorize()` is called (not `auth.api.getSession`). This is the pattern compliance issue caught in F6-FIX.
7. **CASL check:** `ability.can('update', sub('User', { id: session.userId }))` is checked.
8. **No new schema:** No columns added to `user` table, no new tables created.
9. **No new CASL subjects:** `UserInterest` is NOT added to subjects.ts.
10. **Route:** Page is at `/auth/onboarding`, not any other path.
11. **Seed idempotency:** New seed tags use `onConflictDoNothing()`.
12. **Helpers unexported:** Any helper functions in the `'use server'` file must not be exported.
