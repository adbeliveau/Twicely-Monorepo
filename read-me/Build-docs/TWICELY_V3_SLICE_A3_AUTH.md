# TWICELY V3 — Phase A3: Auth + User Creation

**Slice:** A3  
**Prerequisite:** A2 complete (93 tables pushed, TypeScript clean)  
**Goal:** Better Auth configured with Drizzle adapter. Email/password signup, email verification, login, logout, password reset. Session management. Auth middleware. Basic auth UI pages. User record created in DB on signup.

---

## OWNER DIRECTIVES — FROM ADRIAN

1. **The project root is `C:\Users\XPS-15\Projects\Twicely`.** Not a subfolder. Not `twicely-v3`. "V3" is a planning label only.

2. **Write the plan FIRST. Do NOT start coding.** Present: complete file list (path + one-line description), step-by-step execution plan, confirmations of what's excluded. Wait for approval.

3. **Better Auth uses the EXISTING schema tables.** The `user`, `session`, `account`, and `verification` tables already exist in the database from A2. Better Auth must use these tables via its Drizzle adapter — do NOT let Better Auth create its own tables or run its own migrations. Point the adapter at the existing schema exports.

4. **Email in dev = console logging.** We don't have Resend configured yet. Use a console transport that logs the email content (verification links, reset links) to the terminal. Wire Resend later.

5. **No CASL in A3.** Authorization is Phase A4. A3 only handles authentication (who are you?), not authorization (what can you do?). The only access control in A3 is: is the user logged in or not?

6. **No seed data.** Seeding is A5.

---

## CRITICAL RULES

1. **Use Better Auth, NOT NextAuth.** Better Auth is the locked choice. Do not import from `next-auth`, `@auth/core`, or any NextAuth package.

2. **Use the existing Drizzle schema.** The `user`, `session`, `account`, `verification` tables are already defined in `src/lib/db/schema/auth.ts` and pushed to the database. Import them. Do not redefine them.

3. **No `as any`. No `@ts-ignore`. No `as unknown as T`.** Fix the type, don't cast.

4. **No file over 300 lines.** Split if approaching.

5. **All auth pages go under `src/app/auth/`.** Not `src/app/(auth)/`, not `src/app/login/`. The Page Registry says `/auth/login`, `/auth/signup`, etc.

6. **Settings pages go under `src/app/(marketplace)/my/settings/`.** Already in the route group from A1.

7. **Do NOT create files not in the approved file list.**

8. **The user table has marketplace extension fields.** Better Auth manages the core fields (id, name, email, emailVerified, image, createdAt, updatedAt). Our schema adds marketplace fields (displayName, username, bio, phone, isSeller, buyerQualityTier, etc.) via `additionalFields` in the Better Auth config. These fields already exist in the DB from A2 — just tell Better Auth about them.

---

## WHAT A3 DELIVERS

When A3 is done, a developer can:

1. Visit `/auth/signup` → fill name, email, password → user record created in `user` table → redirected to verify-email page
2. Check terminal for verification email link (console transport) → click link → `emailVerified` = true
3. Visit `/auth/login` → enter email + password → session created → redirected to `/my`
4. Visit `/my/settings` → see profile form (name, displayName, username, bio) → save changes
5. Visit `/my/settings/security` → change password → see active sessions → revoke a session
6. Click logout → session deleted from DB → redirected to `/auth/login`
7. Visit `/auth/forgot-password` → enter email → check terminal for reset link → click link → set new password → redirected to login
8. Try to visit `/my/settings` while logged out → redirected to `/auth/login`

That's it. No selling, no buying, no admin panel, no CASL checks. Just: sign up, verify, log in, edit profile, manage sessions, log out, reset password.

---

## SCOPING DECISIONS

### IN SCOPE (A3)

| Feature | Source | Notes |
|---------|--------|-------|
| Better Auth server config | Tech Stack, Security §1 | Drizzle adapter, Argon2id, session config |
| Better Auth client config | Tech Stack | React hooks for client-side auth state |
| Auth API route | — | `/api/auth/[...all]` catch-all route |
| Signup (email/password) | Page Registry #18 | Name + email + password + terms checkbox |
| Email verification | Page Registry #21, Security §1.1 | Token-gated verify page, console transport in dev |
| Login | Page Registry #17 | Email + password, generic error messages |
| Logout | Security §1.2 | Server-side session deletion |
| Password reset | Page Registry #19-20 | Forgot + reset pages, 1-hour token expiry |
| Session management | Security §1.2 | HTTP-only cookies, 7-day timeout, max 5 sessions |
| Auth middleware | Security §5.1 | Protect `/my/*` routes, redirect logic |
| Account settings page | Page Registry #72 | Profile form (name, displayName, username, bio, phone) |
| Security settings page | Page Registry #74 | Change password, view/revoke active sessions |
| Rate limiting on auth routes | Security §1.1 🔴 | 5 failed logins → 15 min lockout |
| Password min 10 chars | Security §1.1 🔴 | Client + server validation |
| Generic auth errors | Security §1.1 🔴 | "Invalid credentials" — don't reveal if email exists |
| Password reset doesn't confirm email | Security §1.1 🔴 | Same message whether email exists or not |

### OUT OF SCOPE (later phases)

| Feature | Phase | Why |
|---------|-------|-----|
| Hub staff login (`hub.twicely.co/login`) | E3 | Separate auth system (staffUser/staffSession), not Better Auth. Complex enough for its own slice. |
| TOTP / 2FA | A3b or C | Better Auth has TOTP plugin. Enable it when security settings page is mature. |
| OAuth / social login | Post-beta | Page Registry shows OAuth buttons but Build Brief says email/password first. |
| HaveIBeenPwned breach check | Post-beta | Requires external API. Security doc marks it 🔴 but it needs network access. |
| CASL authorization | A4 | A3 = authentication only. A4 = authorization. |
| Seed data | A5 | No demo users in A3. |
| COPPA age gate | G1 | Onboarding page is G1. |
| Session binding (IP/UA) | Post-A3 | Warn on change, don't auto-kill. Can add after basic sessions work. |
| Impossible travel detection | Post-beta | Security §1.4, needs GeoIP service. |

---

## BETTER AUTH CONFIGURATION SPEC

### Server Config (`src/lib/auth/server.ts`)

```typescript
// This is the SHAPE, not copy-paste code. Adapt to Better Auth's actual API.
{
  database: drizzleAdapter(db, {
    // Point at existing schema tables from A2
    user: schema.user,
    session: schema.session,
    account: schema.account,
    verification: schema.verification,
  }),
  
  // Marketplace extension fields on user table
  user: {
    additionalFields: {
      displayName: { type: 'string', required: false },
      username: { type: 'string', required: false },
      bio: { type: 'string', required: false },
      phone: { type: 'string', required: false },
      phoneVerified: { type: 'boolean', defaultValue: false },
      avatarUrl: { type: 'string', required: false },
      defaultAddressId: { type: 'string', required: false },
      isSeller: { type: 'boolean', defaultValue: false },
      buyerQualityTier: { type: 'string', defaultValue: 'GREEN' },
      dashboardLayoutJson: { type: 'string', required: false },
      marketingOptIn: { type: 'boolean', defaultValue: false },
      deletionRequestedAt: { type: 'date', required: false },
      isBanned: { type: 'boolean', defaultValue: false },
      bannedAt: { type: 'date', required: false },
      bannedReason: { type: 'string', required: false },
    },
  },
  
  session: {
    cookieCache: { enabled: true, maxAge: 300 }, // 5 min cache
    expiresIn: 60 * 60 * 24 * 7, // 7 days (buyer/seller timeout)
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // Console transport for dev
      console.log(`[EMAIL] Password reset for ${user.email}: ${url}`);
    },
  },
  
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Console transport for dev
      console.log(`[EMAIL] Verify email for ${user.email}: ${url}`);
    },
  },
  
  // Account security
  account: {
    accountLinking: { enabled: false }, // No OAuth yet
  },
  
  // Rate limiting on auth endpoints
  rateLimit: {
    window: 60, // 1 minute
    max: 10, // 10 requests per minute per IP
    // Login-specific: 5 failed attempts → 15 min lockout
    // (May need custom implementation if Better Auth doesn't support per-route limits)
  },
  
  // Advanced config
  advanced: {
    cookiePrefix: 'twicely',
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  },
}
```

**IMPORTANT:** The config above is a SHAPE showing what needs to be configured. Read Better Auth's actual documentation for the correct API. The exact property names and nesting may differ. What matters is that these features are configured:
- Drizzle adapter pointing at existing A2 tables
- User additional fields matching the marketplace columns
- 10-char min password, 128 max
- Email verification on signup with console transport
- Password reset with console transport  
- 7-day session timeout
- HTTP-only, secure, SameSite=Lax cookies
- Rate limiting on auth routes

### Client Config (`src/lib/auth/client.ts`)

Better Auth's client library for React. Provides hooks like `useSession()`, `signIn()`, `signUp()`, `signOut()`, etc. The client config points at the auth API route.

### Auth API Route (`src/app/api/auth/[...all]/route.ts`)

Better Auth's catch-all route handler. Handles all auth endpoints (login, signup, verify, reset, session, etc.) via a single route.

---

## AUTH MIDDLEWARE SPEC

**File:** `src/middleware.ts` (Next.js middleware at project root)

**Logic:**
1. If path starts with `/auth/` AND user is authenticated → redirect to `/my`
2. If path starts with `/my/` AND user is NOT authenticated → redirect to `/auth/login`
3. If path starts with `/api/auth/` → pass through (Better Auth handles these)
4. All other paths → pass through (public routes)

**Session check in middleware:** Better Auth provides a way to validate sessions in Edge middleware. Use their recommended approach (typically checking the session cookie existence + optional validation).

**Do NOT block:** `/`, `/s`, `/i/*`, `/st/*`, `/c/*`, `/h/*`, `/p/*`, `/api/*` — these are public routes.

---

## AUTH PAGES SPEC

All auth pages use a centered card layout (no sidebar, no dashboard chrome). Clean, minimal. Twicely logo at top.

### `/auth/login` — Log In

**Form fields:**
- Email (text input, required)
- Password (password input, required)
- "Remember me" checkbox (optional, extends session)

**Links:**
- "Don't have an account? Sign up" → `/auth/signup`
- "Forgot your password?" → `/auth/forgot-password`

**Behavior:**
- On success: redirect to `/my` (or return URL if provided via `?redirect=`)
- On error: show "Invalid email or password" (NEVER say "email not found" or "wrong password" separately)
- On too many attempts: show "Too many login attempts. Please try again in X minutes."

**States:** DEFAULT, ERROR, LOCKED (from Page Registry §2.1)

### `/auth/signup` — Sign Up

**Form fields:**
- Full name (text, required)
- Email (email, required)
- Password (password, required, min 10 chars)
- "I agree to the Terms of Service and Privacy Policy" checkbox (required, links to `/p/terms` and `/p/privacy`)

**Behavior:**
- On success: create user record → send verification email → redirect to `/auth/verify-email`
- On error: show inline validation (email taken, password too short)
- Password strength indicator (optional but nice)

**States:** DEFAULT, ERROR, SUCCESS

### `/auth/verify-email` — Verify Email

**Two modes:**
1. **Interstitial (no token):** "Check your email for a verification link. Didn't receive it? [Resend]"
2. **Token processing (with token param):** Verify token → if valid, mark email verified → auto-sign in → redirect to `/my`

**Error states:** Invalid token, expired token → "This link has expired. [Request new verification email]"

### `/auth/forgot-password` — Reset Password

**Form fields:**
- Email (email, required)

**Behavior:**
- ALWAYS show "If an account exists for that email, we've sent a reset link." — same message whether email exists or not.
- Send reset email with token (1-hour expiry) via console transport

### `/auth/reset-password` — New Password

**Token-gated:** Must have valid reset token in URL params.

**Form fields:**
- New password (password, required, min 10 chars)
- Confirm password (password, required, must match)

**Behavior:**
- On success: password updated → redirect to `/auth/login` with success message
- On error: invalid/expired token → "This reset link has expired. [Request a new one]"

---

## SETTINGS PAGES SPEC

Settings pages use the dashboard layout (sidebar + main content). For A3, the sidebar can be a simple nav list — it doesn't need the full dashboard chrome yet.

### `/my/settings` — Account Settings

**Form fields:**
- Name (text, from user.name)
- Display name (text, from user.displayName)
- Username (text, from user.username, unique check)
- Bio (textarea, from user.bio)
- Phone (tel, from user.phone)
- Marketing opt-in (checkbox, from user.marketingOptIn)

**Behavior:**
- Load current values from session/DB
- Save via server action or API call
- Show success toast on save
- Username uniqueness checked on blur

### `/my/settings/security` — Security

**Sections:**

1. **Change Password**
   - Current password (required — Security §1.1)
   - New password (min 10 chars)
   - Confirm new password
   
2. **Active Sessions**
   - List all sessions for this user (from `session` table)
   - Show: device/browser (from user-agent), IP address, last active, "Current" badge
   - "Revoke" button on non-current sessions
   - "Revoke all other sessions" button

3. **Two-Factor Authentication** (placeholder for A3)
   - "Coming soon" or disabled state
   - Will be enabled when TOTP plugin is added

---

## RATE LIMITING SPEC

**Auth route rate limits (Security §1.1 🔴 Beta Blocker):**

| Route | Limit | Lockout |
|-------|-------|---------|
| POST login | 5 failed per account per 15 min | 15 min lockout, exponential backoff |
| POST signup | 3 per IP per 10 min | Prevent mass account creation |
| POST forgot-password | 3 per IP per 15 min | Prevent email bombing |
| POST verify-email (resend) | 3 per account per 15 min | Prevent spam |

**Implementation options (in priority order):**
1. Better Auth's built-in rate limiting (if sufficient)
2. Simple in-memory rate limiter (Map-based, good enough for dev/single instance)
3. Valkey-backed rate limiter (for production, but Valkey isn't configured yet)

For A3, use option 1 or 2. Production rate limiting with Valkey comes later.

---

## PROJECT CONTEXT

- **Project root:** `C:\Users\XPS-15\Projects\Twicely`
- **Package name:** `twicely`
- **Database:** `twicely` on Neon (PostgreSQL)
- **DATABASE_URL:** In `.env.local`
- **ORM:** Drizzle ORM (NOT Prisma)
- **Auth:** Better Auth (NOT NextAuth)
- **Existing schema:** 93 tables in `src/lib/db/schema/`, barrel at `src/lib/db/schema/index.ts`
- **Existing db connection:** `src/lib/db/index.ts`
- **Existing from A1:** `src/lib/auth/` directory exists (may have placeholder files)
- **Required packages:** `better-auth` (may already be installed from A1 — check first)

---

## STEP-BY-STEP EXECUTION

### Step 0: Present plan for approval (MANDATORY)

Before writing ANY code, present:
1. Complete file list (path + one-line description)
2. Creation order
3. Packages to install (check what's already installed first)
4. Confirmations: "No CASL, no seed data, no hub staff auth, no OAuth, no TOTP"

**STOP AND WAIT for approval.**

### Step 1: Check existing state

```bash
cat package.json | grep better-auth
ls src/lib/auth/
cat src/lib/auth/*.ts 2>/dev/null
cat src/middleware.ts 2>/dev/null
```

Show what exists. Don't overwrite working code blindly.

### Step 2: Install packages (if needed)

```bash
pnpm add better-auth
# Check if already installed first!
```

### Step 3: Create Better Auth server config

`src/lib/auth/server.ts` — The main Better Auth instance. Drizzle adapter pointing at existing schema tables. All config from the spec above.

### Step 4: Create Better Auth client config

`src/lib/auth/client.ts` — Client-side auth hooks.

### Step 5: Create auth API route

`src/app/api/auth/[...all]/route.ts` — Catch-all handler.

### Step 6: Create auth middleware

`src/middleware.ts` — Route protection per spec above.

### Step 7: Create auth layout

`src/app/auth/layout.tsx` — Centered card layout for auth pages.

### Step 8: Create auth pages (5 pages)

In order: login → signup → verify-email → forgot-password → reset-password

### Step 9: Create settings layout + pages

Settings sidebar nav + account settings page + security page.

### Step 10: Create `getSession` helper

Server-side session helper for use in server components and server actions.

### Step 11: TypeScript check

```bash
npx tsc --noEmit
```

Zero errors.

### Step 12: Manual test

Start the dev server:
```bash
pnpm dev
```

Verify these flows work:
1. Sign up → check terminal for verification link
2. Click verification link → email verified → signed in
3. Log out → redirected to login
4. Log in → redirected to /my
5. Visit /my/settings → see profile form
6. Change password in /my/settings/security
7. Try /my while logged out → redirected to /auth/login
8. Forgot password → check terminal → reset password → log in

### Step 13: Save checkpoint

```bash
tar -cf ../twicely-a3-auth.tar --exclude=node_modules --exclude=.next --exclude=.git .
```

---

## AUDIT CHECKLIST

| # | Check | How | Expected |
|---|-------|-----|----------|
| 1 | TypeScript compiles | `npx tsc --noEmit` | Zero errors |
| 2 | No `as any` | `grep -r "as any" src/lib/auth/ src/app/auth/ src/app/(marketplace)/my/settings/` | No matches |
| 3 | No `@ts-ignore` | Same grep with `@ts-ignore` | No matches |
| 4 | No NextAuth imports | `grep -r "next-auth\|@auth/core" src/` | No matches |
| 5 | Signup creates user in DB | Sign up → check `user` table | Row exists with email, emailVerified=false |
| 6 | Email verification works | Click console link → check DB | emailVerified=true |
| 7 | Login creates session | Log in → check `session` table | Row exists |
| 8 | Logout deletes session | Log out → check `session` table | Row gone |
| 9 | /my redirects when not auth | Visit /my logged out | Redirect to /auth/login |
| 10 | /auth/login redirects when auth | Visit /auth/login logged in | Redirect to /my |
| 11 | Password reset doesn't leak emails | Enter non-existent email | Same success message |
| 12 | Password min 10 chars enforced | Try 8-char password on signup | Rejected |
| 13 | Settings pages load | Visit /my/settings, /my/settings/security | Pages render |
| 14 | No file over 300 lines | `wc -l` on all new files | All under 300 |
| 15 | Checkpoint saved | Check parent directory | `twicely-a3-auth.tar` exists |

---

## WHAT NOT TO DO

❌ **Do not look for or create a `twicely-v3` subfolder.** Project root is `C:\Users\XPS-15\Projects\Twicely`.

❌ **Do not use NextAuth.** Not `next-auth`, not `@auth/core`, not `authjs`. Better Auth only.

❌ **Do not create new database tables.** All tables exist from A2. Better Auth uses them via adapter.

❌ **Do not run `drizzle-kit push` or any migrations.** Schema is already pushed. A3 doesn't change the schema.

❌ **Do not implement CASL, ability checks, or role-based access.** That's A4. A3 only checks: logged in or not.

❌ **Do not implement hub staff auth.** Staff login uses a separate auth system (staffUser/staffSession). It's a different slice.

❌ **Do not add OAuth / social login.** Email/password only for now.

❌ **Do not implement TOTP / 2FA.** Show a placeholder on the security page. Wire it later.

❌ **Do not create seed data or demo users.**

❌ **Do not install Zustand, tRPC, or any state management library.** Use React server components + server actions.

❌ **Do not create a separate "types" file for auth types.** Better Auth + Drizzle schema provide all types.

❌ **Do not add `"use client"` to files that don't need it.** Server components are the default. Only add `"use client"` to files with hooks, event handlers, or browser APIs.

---

## KNOWN GOTCHAS

1. **Better Auth + Drizzle adapter:** Better Auth's Drizzle adapter needs the schema tables passed in. Make sure you import from `@/lib/db/schema` (the barrel) and pass the actual table objects, not strings.

2. **Better Auth expects specific column names.** The `user` table must have `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`. Our A2 schema has all of these — verify they match Better Auth's expectations exactly.

3. **Session table columns.** Better Auth expects `session` to have `id`, `userId`, `token`, `expiresAt`, etc. Our A2 schema defined these per Better Auth's requirements. Verify the column names match.

4. **`user` and `session` are reserved PostgreSQL words.** Drizzle auto-quotes them. Better Auth should handle this via the Drizzle adapter, but if you see "relation does not exist" errors, check quoting.

5. **Next.js middleware runs on Edge.** Some Better Auth features may not work in Edge runtime. Check Better Auth docs for middleware session validation approach. You may need to use a lightweight cookie check in middleware and do full validation in server components.

6. **`.env.local` variables.** Better Auth needs `BETTER_AUTH_SECRET` (for signing tokens/cookies) and `BETTER_AUTH_URL` (base URL). Add these to `.env.local` if not already present:
   ```
   BETTER_AUTH_SECRET=<generate-a-random-32-char-string>
   BETTER_AUTH_URL=http://localhost:3000
   ```

7. **The `account` table.** Better Auth uses this for OAuth providers. With email/password only, it may or may not create a row here. Don't assume it will — check Better Auth's behavior.

8. **Verification tokens.** Better Auth stores email verification and password reset tokens in the `verification` table. Our A2 schema has this table. Make sure the adapter knows about it.

---

## REFERENCE DOCUMENTS

- **Schema:** `TWICELY_V3_SCHEMA.md` §2.1–2.2 (user, session, account, verification tables)
- **Page Registry:** `TWICELY_V3_PAGE_REGISTRY.md` §2 (auth pages), §5 (settings pages)
- **Security:** `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` §1.1 (passwords), §1.2 (sessions), §5.1 (route protection)
- **Build Brief:** `TWICELY_V3_BUILD_BRIEF.md` — Phase A table, A3 row
- **Tech Stack:** `TWICELY_V3_TECH_STACK.pdf` — Auth section (Better Auth)

---

**END OF A3 PROMPT**
