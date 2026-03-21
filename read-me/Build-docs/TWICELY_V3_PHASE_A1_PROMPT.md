# PHASE A1: PROJECT SCAFFOLD — Claude Code Instructions

## BEFORE YOU DO ANYTHING — READ THIS ENTIRE DOCUMENT. ALL OF IT. DO NOT SKIP AHEAD.

You are building the scaffold for Twicely V3. This is Phase A1 — project initialization ONLY.

---

## CORE PHILOSOPHY — UNDERSTAND THIS BEFORE WRITING CODE

Twicely V3 has a provider system. NOTHING is hardcoded to a specific vendor. Every external service — email, storage, search, SMS, push, payments, shipping, realtime — is an adapter behind a provider abstraction. The admin configures which providers are active from the UI. No code changes to swap providers.

**This means:** We do NOT install vendor-specific SDKs at scaffold time. No `resend`, no `@aws-sdk/client-ses`, no `@sendgrid/mail`. Those get installed later as individual adapter packages when we build each provider adapter. At scaffold time, we install the TEMPLATE layer (React Email for email templates) but NOT the transport layer.

---

## YOUR BEHAVIORAL CONTRACT

You have a history of:
- Adding packages not in the spec
- Creating files not in the spec
- Renaming things because you think your name is better
- Substituting technologies (especially Prisma for Drizzle, NextAuth for Better Auth)
- Skipping verification steps
- Creating "helpful" placeholder files nobody asked for
- Adding TODO comments and stub functions
- Loosening TypeScript strictness when you hit type errors

**ALL OF THE ABOVE ARE FAILURES. EVERY ONE.**

Here is how you will work on this project:

1. Read the step completely
2. Execute EXACTLY what the step says — nothing more, nothing less
3. Run the verification command
4. If verification fails — FIX IT. Do not move on. Do not comment it out. Do not add `@ts-ignore`. Do not set `skipLibCheck: true`. FIX THE ACTUAL PROBLEM.
5. When verification passes — create a tar checkpoint
6. Only then move to the next step

**If something isn't in this prompt, it doesn't exist. Don't create it. Don't install it. Don't even think about it.**

---

## TECH STACK — LOCKED. NOT NEGOTIABLE. NOT SUBSTITUTABLE.

| Use This | NOT This | If You Use The Wrong One You Must Delete It And Start Over |
|----------|----------|------------------------------------------------------------|
| Drizzle ORM | Prisma | Yes, start over |
| Better Auth | NextAuth, Lucia, Auth.js | Yes, start over |
| CASL | Custom RBAC, any other authz lib | Yes, start over |
| Tailwind + shadcn/ui | MUI, Chakra, Ant Design, Mantine | Yes, start over |
| React Email (templates only) | — | No transport SDKs yet |
| Vitest | Jest | Yes, start over |
| Playwright | Cypress, TestCafe | Yes, start over |
| pnpm | npm, yarn, bun | Yes, start over |

If at any point you catch yourself typing `prisma`, `next-auth`, `zustand`, `trpc`, `jest`, `cypress`, `axios`, `mongoose`, `redis`, `socket.io`, `nodemailer`, `resend`, or `@aws-sdk` — STOP. You are going off-script. Delete what you just did.

---

## STEP 1: Create Next.js Project

Do this and ONLY this:

```bash
npx create-next-app@latest twicely-v3 \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm
```

Answer the prompts:
- TypeScript? **Yes**
- ESLint? **Yes**
- Tailwind CSS? **Yes**
- `src/` directory? **Yes**
- App Router? **Yes**
- Turbopack? **Yes**
- Import alias? **Yes** → `@/*`

**VERIFY (do not skip):**
```bash
cd twicely-v3
pnpm dev &
sleep 5
curl -s http://localhost:3000 | head -20
kill %1
```
Must see HTML output. If it errors, fix it before proceeding.

**CHECKPOINT:**
```bash
tar czf ../a1-step01-nextjs-created.tar.gz .
echo "STEP 1 COMPLETE"
```

---

## STEP 2: Lock Down TypeScript

Replace the ENTIRE contents of `tsconfig.json` with exactly this. Do not add fields. Do not remove fields. Do not change values.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": false,
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**THE FOLLOWING ARE BANNED FOREVER:**
- `skipLibCheck: true` — BANNED. If a library has type errors, fix the import or add a declaration file. Do NOT skip checking.
- `as any` — BANNED. Anywhere in the codebase. Ever.
- `as unknown as T` — BANNED.
- `@ts-ignore` — BANNED.
- `@ts-expect-error` — BANNED.
- `// eslint-disable` — BANNED unless you can explain exactly why and Adrian approves.

**VERIFY:**
```bash
pnpm tsc --noEmit
echo "Exit code: $?"
```
Exit code must be 0. Zero errors. If there are errors from Next.js generated files, that's expected before first build — run `pnpm build` first, then re-check.

**CHECKPOINT:**
```bash
tar czf ../a1-step02-typescript-locked.tar.gz .
echo "STEP 2 COMPLETE"
```

---

## STEP 3: Install Dependencies — ONLY THESE, NOTHING ELSE

Read this list. Install EXACTLY these packages. Count them. If your installed count doesn't match, you added something you shouldn't have.

**Group 1 — Core (4 packages):**
```bash
pnpm add drizzle-orm postgres @paralleldrive/cuid2 zod
```

**Group 2 — Auth (1 package):**
```bash
pnpm add better-auth
```

**Group 3 — Authorization (2 packages):**
```bash
pnpm add @casl/ability @casl/react
```

**Group 4 — UI utilities (4 packages):**
```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react
```

**Group 5 — Email templates (1 package — TEMPLATE LAYER ONLY, NO TRANSPORT):**
```bash
pnpm add @react-email/components
```

NOTE: Do NOT install `resend`, `nodemailer`, `@aws-sdk/client-ses`, `@sendgrid/mail`, or any other email transport package. Email transport is handled by the provider system — each transport is an adapter installed when we build that adapter. React Email only renders templates to HTML. It does not send anything.

**Group 6 — Forms (2 packages):**
```bash
pnpm add react-hook-form @hookform/resolvers
```

**Group 7 — Dev: Database tooling (2 packages):**
```bash
pnpm add -D drizzle-kit @types/node
```

**Group 8 — Dev: Testing (3 packages):**
```bash
pnpm add -D vitest @vitejs/plugin-react @playwright/test
```

**TOTAL: 14 runtime dependencies + 5 dev dependencies** (plus whatever create-next-app installed).

**VERIFY — THIS IS CRITICAL:**
```bash
echo "=== BANNED PACKAGE CHECK ==="
FOUND=0
for pkg in prisma @prisma/client next-auth @auth/core lucia zustand jotai redux @reduxjs/toolkit @trpc/server @trpc/client @tanstack/react-query axios mongoose redis ioredis bull bullmq socket.io socket.io-client pusher pusher-js nodemailer @aws-sdk @sendgrid resend jest @jest cypress @testing-library styled-components @emotion @mui @chakra-ui @mantine; do
  if grep -q "\"$pkg" package.json 2>/dev/null; then
    echo "VIOLATION: $pkg found in package.json — REMOVE IT NOW"
    FOUND=1
  fi
done
[ $FOUND -eq 0 ] && echo "PASS: No banned packages found"
echo "=== CHECK COMPLETE ==="

pnpm tsc --noEmit
echo "TypeScript check exit code: $?"
```

Note that `resend` is now on the banned list. It is a provider adapter, not a core dependency. Both checks must pass clean. If Better Auth or any package causes type errors, read the error carefully and fix it properly. Do NOT add skipLibCheck. Typical fix: you may need to run `pnpm build` once first so Next.js generates its types.

**CHECKPOINT:**
```bash
tar czf ../a1-step03-deps-installed.tar.gz .
echo "STEP 3 COMPLETE"
```

---

## STEP 4: shadcn/ui Setup

```bash
pnpm dlx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Neutral**
- CSS variables: **Yes**

Then install exactly these 6 components. Not 5. Not 7. Exactly 6:

```bash
pnpm dlx shadcn@latest add button input label card separator badge
```

**VERIFY:**
```bash
echo "=== SHADCN COMPONENTS ==="
ls src/components/ui/
echo "=== COUNT ==="
ls src/components/ui/*.tsx | wc -l
echo "(should be 6 component files plus any shadcn utility files)"

pnpm tsc --noEmit
echo "Exit code: $?"
```

**CHECKPOINT:**
```bash
tar czf ../a1-step04-shadcn-done.tar.gz .
echo "STEP 4 COMPLETE"
```

---

## STEP 5: Create Folder Structure

Create ONLY these folders. Do NOT put files in them unless explicitly told to below.

```bash
mkdir -p src/app/\(marketplace\)
mkdir -p src/app/\(hub\)
mkdir -p src/app/api
mkdir -p src/app/auth
mkdir -p src/components/shared
mkdir -p src/lib/auth
mkdir -p src/lib/db/schema
mkdir -p src/lib/utils
mkdir -p src/types
mkdir -p src/config
mkdir -p e2e
mkdir -p drizzle
```

**VERIFY:**
```bash
echo "=== FOLDER STRUCTURE ==="
find src -type d | sort
echo ""
echo "If you see folders NOT in the spec, DELETE THEM NOW."
```

Expected (plus `src/components/ui` from shadcn):
```
src
src/app
src/app/(hub)
src/app/(marketplace)
src/app/api
src/app/auth
src/components
src/components/shared
src/components/ui
src/config
src/lib
src/lib/auth
src/lib/db
src/lib/db/schema
src/lib/utils
src/types
```

**CHECKPOINT:**
```bash
tar czf ../a1-step05-folders-created.tar.gz .
echo "STEP 5 COMPLETE"
```

---

## STEP 6: Create Source Files — EXACTLY AS WRITTEN

You will now create exactly 7 files. Copy the content EXACTLY. Do not modify. Do not add imports. Do not add comments. Do not "improve" anything.

### File 1 of 7: `src/lib/db/index.ts`

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString);
export const db = drizzle(client);
```

### File 2 of 7: `src/lib/db/schema/index.ts`

```typescript
// Schema barrel file — each domain gets its own file.
// Created in Phase A2. DO NOT add schema definitions here yet.
export {};
```

### File 3 of 7: `src/lib/utils/cn.ts`

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

**IMPORTANT:** After creating this file, check if shadcn created `src/lib/utils.ts`. If that file exists:
1. Delete `src/lib/utils.ts`
2. Find every file in `src/components/ui/` that imports from `@/lib/utils`
3. Change those imports to: `import { cn } from '@/lib/utils/cn'`
4. Verify with `pnpm tsc --noEmit` before continuing

### File 4 of 7: `src/config/constants.ts`

```typescript
export const APP_NAME = 'Twicely' as const;

export const DOMAINS = {
  marketplace: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  hub: process.env.NEXT_PUBLIC_HUB_URL ?? 'http://localhost:3000',
} as const;

export const ROUTES = {
  home: '/',
  search: '/s',
  login: '/auth/login',
  signup: '/auth/signup',
  dashboard: '/my',
  sellerDashboard: '/my/selling',
  hubDashboard: '/d',
} as const;
```

### File 5 of 7: `.env.example` (project root)

```env
# Database (ONLY hardcoded external dependency)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/twicely_v3

# Better Auth
BETTER_AUTH_SECRET=change-me-to-a-random-32-char-string
BETTER_AUTH_URL=http://localhost:3000

# Master encryption key (encrypts all provider secrets in database)
MASTER_ENCRYPTION_KEY=change-me-to-a-random-64-hex-string

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_HUB_URL=http://localhost:3000

# NOTE: No API keys here. All provider credentials (Stripe, Shippo,
# email, storage, search, SMS, push) are stored encrypted in the
# database and configured through the admin UI at hub.twicely.co/cfg.
# Only DATABASE_URL and MASTER_ENCRYPTION_KEY live in .env.
```

### File 6 of 7: `.env.local` (project root)

Same content as `.env.example`. Verify `.gitignore` contains `.env*.local`.

### File 7 of 7: `drizzle.config.ts` (project root — NOT inside src)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

**VERIFY all 7 files exist and compile:**
```bash
echo "=== FILE CHECK ==="
test -f src/lib/db/index.ts && echo "OK: db/index.ts" || echo "MISSING: db/index.ts"
test -f src/lib/db/schema/index.ts && echo "OK: schema/index.ts" || echo "MISSING: schema/index.ts"
test -f src/lib/utils/cn.ts && echo "OK: utils/cn.ts" || echo "MISSING: utils/cn.ts"
test -f src/config/constants.ts && echo "OK: constants.ts" || echo "MISSING: constants.ts"
test -f .env.example && echo "OK: .env.example" || echo "MISSING: .env.example"
test -f .env.local && echo "OK: .env.local" || echo "MISSING: .env.local"
test -f drizzle.config.ts && echo "OK: drizzle.config.ts" || echo "MISSING: drizzle.config.ts"

echo ""
echo "=== OLD UTILS CHECK ==="
test -f src/lib/utils.ts && echo "WARNING: src/lib/utils.ts still exists — DELETE IT and update imports" || echo "OK: no old utils.ts"

echo ""
echo "=== ENV SANITY CHECK ==="
grep -c "RESEND_API_KEY\|STRIPE_SECRET\|SHIPPO_API\|SENDGRID" .env.example && echo "VIOLATION: Found hardcoded provider keys in .env.example — REMOVE THEM" || echo "OK: No hardcoded provider keys in .env"

echo ""
pnpm tsc --noEmit
echo "TypeScript exit code: $?"
```

All 7 must show OK. No hardcoded provider keys in .env. TypeScript must exit 0.

**CHECKPOINT:**
```bash
tar czf ../a1-step06-files-created.tar.gz .
echo "STEP 6 COMPLETE"
```

---

## STEP 7: Test & Build Configuration

### File 8: `vitest.config.ts` (project root)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### File 9: `playwright.config.ts` (project root)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Update `package.json` scripts

Replace the scripts section with EXACTLY this. Do NOT add other scripts. Do NOT rename these.

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

### Install Playwright browsers:

```bash
pnpm exec playwright install chromium
```

**VERIFY:**
```bash
pnpm typecheck
echo "typecheck exit: $?"

pnpm test 2>&1 | tail -5
echo "vitest done"
```

**CHECKPOINT:**
```bash
tar czf ../a1-step07-test-config-done.tar.gz .
echo "STEP 7 COMPLETE"
```

---

## STEP 8: ESLint — Ban `any`

Check what ESLint config file exists:

```bash
ls -la .eslintrc* eslint.config* 2>/dev/null
```

Whichever file exists, ensure `no-explicit-any` is an ERROR. You may need to install the TypeScript ESLint packages:

```bash
pnpm add -D @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

If `.eslintrc.json`:
```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

If flat config (`eslint.config.mjs`), adapt the rules to achieve the same result.

**VERIFY:**
```bash
pnpm lint
echo "lint exit: $?"
```

Must exit 0. If shadcn components use `any`, fix them with proper types — do NOT disable the rule.

**CHECKPOINT:**
```bash
tar czf ../a1-step08-eslint-done.tar.gz .
echo "STEP 8 COMPLETE"
```

---

## STEP 9: Clean Default Files + Final App Shell

Replace `src/app/layout.tsx` with EXACTLY:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Twicely',
  description: 'Buy & sell secondhand',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

Replace `src/app/page.tsx` with EXACTLY:

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">Twicely V3</h1>
    </main>
  );
}
```

Delete Next.js default junk:
```bash
rm -f src/app/page.module.css 2>/dev/null
rm -f public/next.svg 2>/dev/null
rm -f public/vercel.svg 2>/dev/null
rm -f public/*.svg 2>/dev/null
```

**VERIFY — THE BIG ONE. All 4 must pass:**
```bash
pnpm typecheck && echo "✓ typecheck" || echo "✗ typecheck FAILED"
pnpm lint && echo "✓ lint" || echo "✗ lint FAILED"
pnpm test 2>&1 | tail -3; echo "✓ vitest done"
pnpm build && echo "✓ build" || echo "✗ build FAILED"
```

**CHECKPOINT:**
```bash
tar czf ../a1-step09-clean-shell.tar.gz .
echo "STEP 9 COMPLETE"
```

---

## STEP 10: Final Audit — YOU ARE NOT DONE UNTIL EVERY CHECK PASSES

### Audit 1: File inventory

```bash
echo "========== AUDIT 1: FILE INVENTORY =========="
echo "--- Source files ---"
find src -type f | sort
echo ""
echo "--- Root config files ---"
ls *.json *.ts *.mjs *.config.* .env.example .eslintrc* .gitignore 2>/dev/null
echo "========== END AUDIT 1 =========="
```

Your src files should be APPROXIMATELY:
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/separator.tsx`
- `src/config/constants.ts`
- `src/lib/db/index.ts`
- `src/lib/db/schema/index.ts`
- `src/lib/utils/cn.ts`

Plus any shadcn utility files. **If you see files NOT on this list, explain what they are or delete them.**

### Audit 2: No banned packages

```bash
echo "========== AUDIT 2: BANNED PACKAGES =========="
FOUND=0
for pkg in prisma @prisma/client next-auth @auth/core lucia zustand jotai redux @reduxjs/toolkit @trpc/server @trpc/client @tanstack/react-query axios mongoose redis ioredis bull bullmq socket.io socket.io-client pusher pusher-js nodemailer @aws-sdk @sendgrid resend jest @jest cypress @testing-library styled-components @emotion @mui @chakra-ui @mantine; do
  if grep -q "\"$pkg" package.json 2>/dev/null; then
    echo "VIOLATION: $pkg found — REMOVE IT"
    FOUND=1
  fi
done
[ $FOUND -eq 0 ] && echo "PASS: No banned packages found"
echo "========== END AUDIT 2 =========="
```

### Audit 3: No `any` in our code

```bash
echo "========== AUDIT 3: NO ANY =========="
FOUND=0
if grep -rn ": any" src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then FOUND=1; fi
if grep -rn "as any" src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then FOUND=1; fi
if grep -rn "@ts-ignore" src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then FOUND=1; fi
if grep -rn "@ts-expect-error" src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then FOUND=1; fi
[ $FOUND -eq 0 ] && echo "PASS: No any/ts-ignore found"
echo "========== END AUDIT 3 =========="
```

### Audit 4: TypeScript strictness

```bash
echo "========== AUDIT 4: TSCONFIG STRICT =========="
grep '"strict": true' tsconfig.json && echo "✓ strict: true" || echo "✗ strict MISSING"
grep '"skipLibCheck": false' tsconfig.json && echo "✓ skipLibCheck: false" || echo "✗ skipLibCheck WRONG"
grep '"noUncheckedIndexedAccess": true' tsconfig.json && echo "✓ noUncheckedIndexedAccess" || echo "✗ noUncheckedIndexedAccess MISSING"
echo "========== END AUDIT 4 =========="
```

### Audit 5: No hardcoded provider keys

```bash
echo "========== AUDIT 5: NO HARDCODED PROVIDERS =========="
FOUND=0
for key in RESEND_API_KEY STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY SHIPPO_API_TOKEN SENDGRID_API_KEY AWS_ACCESS_KEY AWS_SECRET_KEY TELNYX_API_KEY FIREBASE_API_KEY TYPESENSE_API_KEY MEILISEARCH_API_KEY R2_ACCESS_KEY; do
  if grep -q "$key" .env.example 2>/dev/null || grep -q "$key" .env.local 2>/dev/null; then
    echo "VIOLATION: $key found in env files — provider keys belong in the database, not .env"
    FOUND=1
  fi
done
[ $FOUND -eq 0 ] && echo "PASS: No hardcoded provider keys"
echo "========== END AUDIT 5 =========="
```

### Audit 6: Clean build

```bash
echo "========== AUDIT 6: BUILD =========="
pnpm build 2>&1 | tail -10
echo "Build exit code: $?"
echo "========== END AUDIT 6 =========="
```

### Final checkpoint:

```bash
tar czf ../a1-COMPLETE.tar.gz .
echo ""
echo "=========================================="
echo "  PHASE A1 COMPLETE"
echo "  Checkpoints:"
ls -lh ../a1-*.tar.gz
echo "=========================================="
```

---

## REPORT TO ADRIAN

When all 10 steps and all 6 audits pass, respond with:

1. **Full terminal output of all 6 audits** (copy/paste — do not summarize)
2. **The complete `dependencies` and `devDependencies`** from package.json
3. **Confirmation all tar checkpoints exist** (output of `ls -lh ../a1-*.tar.gz`)

Then STOP. Do not proceed to Phase A2. Do not "get a head start." Do not create schema files. Do not install a database. Do not create any auth configuration. STOP AND WAIT for Adrian's approval.

**If Adrian says "proceed to A2" — ask him for the A2 prompt. Do not guess what A2 contains.**
