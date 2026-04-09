# TWICELY V2 — Install Phase 0: Bootstrap
**Status:** LOCKED (v1.0)

Goal: Initialize clean repo, connect Neon DB, apply Prisma baseline, and establish Doctor.

---

## 0) Prerequisites
- Node 20+
- pnpm
- Neon DATABASE_URL

---

## 1) Repository Scaffold

```bash
mkdir twicely-v2 && cd twicely-v2
pnpm init
mkdir -p apps/web packages/core packages/modules prisma scripts rules
```

---

## 2) Next.js App

```bash
cd apps/web
pnpm dlx create-next-app@latest . --ts --app --eslint
cd ../..
```

---

## 3) Environment

Create `.env`:
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="replace"
TWICELY_ENV="dev"
```

---

## 4) Prisma Setup

```bash
pnpm add -D prisma
pnpm add @prisma/client
npx prisma init --schema=prisma/schema.prisma
```

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model HealthCheck {
  id        String   @id @default(cuid())
  key       String   @unique
  status    String
  details   Json     @default("{}")
  updatedAt DateTime @updatedAt
}
```

Run migration:
```bash
npx prisma migrate dev --name init
```

---

## 5) Core Types

`packages/core/types.ts`:
```ts
export type ISODateTime = string;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; message?: string };

// Canonical health status values per System-Health-Canonical-Spec-v1
export const HEALTH_STATUS = {
  PASS: "PASS",
  WARN: "WARN",
  FAIL: "FAIL",
  UNKNOWN: "UNKNOWN",
} as const;

export type HealthStatus = typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS];
```

---

## 6) Doctor Baseline

Install tsx:
```bash
pnpm add -D tsx
```

`scripts/twicely-doctor.ts`:
```ts
import { PrismaClient } from "@prisma/client";
import { HEALTH_STATUS } from "../packages/core/types";

const prisma = new PrismaClient();

(async () => {
  try {
    await prisma.healthCheck.upsert({
      where: { key: "doctor.ping" },
      update: { status: HEALTH_STATUS.PASS, details: { at: new Date().toISOString() } },
      create: { key: "doctor.ping", status: HEALTH_STATUS.PASS, details: { at: new Date().toISOString() } },
    });
    console.log(`doctor: ${HEALTH_STATUS.PASS}`);
    process.exit(0);
  } catch (e) {
    console.error(`doctor: ${HEALTH_STATUS.FAIL}`, e);
    process.exit(1);
  }
})();
```

Root `package.json`:
```json
{
  "scripts": {
    "dev": "pnpm -C apps/web dev",
    "doctor": "tsx scripts/twicely-doctor.ts"
  }
}
```

Run:
```bash
pnpm doctor
```

---

## 7) Completion Criteria
- App boots
- Doctor passes
- HealthCheck table exists

Next: Phase 1 — RBAC & Roles
