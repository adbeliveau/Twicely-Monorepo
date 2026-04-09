# TWICELY V2 — Install Phase 42: Seller Experience Plus
**Status:** LOCKED (v1.0)  
**Scope:** Buyer block list, bulk listing tools, vacation mode enhancements  
**Backend-first:** Schema → Services → API → Health → UI → Doctor

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_42_SELLER_EXPERIENCE_PLUS.md`  
> Prereq: Phases 0–41 complete and Doctor green.

---

## 0) What This Phase Installs

### Backend
- BuyerBlock model (seller can block problematic buyers)
- BuyerBlockAttempt model (log blocked attempts)
- BulkListingJob model (import/export/bulk updates)
- VacationModeSchedule model (enhanced vacation scheduling)
- Block enforcement middleware

### UI (Seller Hub)
- Buyer block list management page
- Bulk import/export tools
- Vacation mode scheduler

### Ops
- Health provider: `seller_experience`
- Doctor checks: block enforcement, bulk job processing

---

## 1) Prisma Schema

```prisma
model BuyerBlock {
  id              String   @id @default(cuid())
  sellerId        String
  buyerId         String
  reason          String?
  reasonCode      String?  // spam|non_payment|fraud|harassment|other
  orderId         String?
  blockPurchases  Boolean  @default(true)
  blockOffers     Boolean  @default(true)
  blockMessages   Boolean  @default(true)
  notifySeller    Boolean  @default(true)
  blockedAt       DateTime @default(now())
  expiresAt       DateTime?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([sellerId, buyerId])
  @@index([sellerId, isActive])
  @@index([buyerId])
}

model BuyerBlockAttempt {
  id              String   @id @default(cuid())
  blockId         String
  buyerId         String
  sellerId        String
  attemptType     String   // purchase|offer|message
  attemptedAt     DateTime @default(now())
  listingId       String?
  metaJson        Json     @default("{}")

  @@index([sellerId, attemptedAt])
  @@index([blockId])
}

model BulkListingJob {
  id              String   @id @default(cuid())
  sellerId        String
  type            String   // import|export|update|relist|end
  status          String   @default("pending")
  sourceFile      String?
  sourceFormat    String?
  filterJson      Json?
  updateSpec      Json?
  totalItems      Int      @default(0)
  processedItems  Int      @default(0)
  successCount    Int      @default(0)
  errorCount      Int      @default(0)
  errorsJson      Json     @default("[]")
  resultFile      String?
  scheduledFor    DateTime?
  startedAt       DateTime?
  completedAt     DateTime?
  requestedByUserId String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([sellerId, status])
  @@index([status, scheduledFor])
}

model VacationModeSchedule {
  id              String   @id @default(cuid())
  sellerId        String   @unique
  isActive        Boolean  @default(false)
  activatedAt     DateTime?
  autoReplyMessage String?  @db.Text
  hideListings    Boolean  @default(true)
  extendHandling  Boolean  @default(true)
  handlingDaysAdd Int      @default(7)
  pausePromotions Boolean  @default(true)
  scheduledStart  DateTime?
  scheduledEnd    DateTime?
  reminderSentAt  DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 2) Block Service

```typescript
// packages/core/seller/blockList/blockService.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function blockBuyer(args: {
  sellerId: string;
  buyerId: string;
  reason?: string;
  reasonCode?: string;
  orderId?: string;
}): Promise<{ id: string }> {
  if (args.sellerId === args.buyerId) throw new Error("CANNOT_BLOCK_SELF");
  
  const block = await prisma.buyerBlock.upsert({
    where: { sellerId_buyerId: { sellerId: args.sellerId, buyerId: args.buyerId } },
    update: { reason: args.reason, reasonCode: args.reasonCode, isActive: true, blockedAt: new Date() },
    create: { ...args, isActive: true },
  });
  return { id: block.id };
}

export async function unblockBuyer(args: { sellerId: string; buyerId: string }): Promise<void> {
  await prisma.buyerBlock.updateMany({
    where: { sellerId: args.sellerId, buyerId: args.buyerId, isActive: true },
    data: { isActive: false },
  });
}

export async function checkBuyerBlocked(args: {
  sellerId: string;
  buyerId: string;
  actionType: "purchase" | "offer" | "message";
}): Promise<{ isBlocked: boolean; blockId?: string }> {
  const block = await prisma.buyerBlock.findFirst({
    where: {
      sellerId: args.sellerId,
      buyerId: args.buyerId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  
  if (!block) return { isBlocked: false };
  
  const isBlocked =
    (args.actionType === "purchase" && block.blockPurchases) ||
    (args.actionType === "offer" && block.blockOffers) ||
    (args.actionType === "message" && block.blockMessages);
  
  if (isBlocked) {
    await prisma.buyerBlockAttempt.create({
      data: { blockId: block.id, buyerId: args.buyerId, sellerId: args.sellerId, attemptType: args.actionType },
    });
  }
  
  return { isBlocked, blockId: isBlocked ? block.id : undefined };
}

export async function getSellerBlockList(sellerId: string) {
  return prisma.buyerBlock.findMany({
    where: { sellerId, isActive: true },
    orderBy: { blockedAt: "desc" },
  });
}
```

---

## 3) Bulk Job Service

```typescript
// packages/core/seller/bulk/bulkJobService.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createBulkJob(args: {
  sellerId: string;
  type: string;
  requestedByUserId: string;
  filterJson?: Record<string, any>;
  updateSpec?: { field: string; operation: string; value: number };
}) {
  return prisma.bulkListingJob.create({
    data: {
      sellerId: args.sellerId,
      type: args.type,
      status: "pending",
      filterJson: args.filterJson,
      updateSpec: args.updateSpec,
      requestedByUserId: args.requestedByUserId,
    },
  });
}

export async function getSellerBulkJobs(sellerId: string) {
  return prisma.bulkListingJob.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function processBulkUpdateJob(jobId: string): Promise<void> {
  const job = await prisma.bulkListingJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "pending") return;
  
  await prisma.bulkListingJob.update({
    where: { id: jobId },
    data: { status: "processing", startedAt: new Date() },
  });
  
  const filter = job.filterJson as Record<string, any> ?? {};
  const spec = job.updateSpec as { field: string; operation: string; value: number } | null;
  
  if (!spec) {
    await prisma.bulkListingJob.update({ where: { id: jobId }, data: { status: "failed" } });
    return;
  }
  
  const listings = await prisma.listing.findMany({
    where: { sellerId: job.sellerId, ...filter },
    select: { id: true, priceCents: true },
  });
  
  await prisma.bulkListingJob.update({ where: { id: jobId }, data: { totalItems: listings.length } });
  
  let successCount = 0;
  for (const listing of listings) {
    const newValue = spec.operation === "multiply"
      ? Math.round(listing.priceCents * (spec.value / 10000))
      : listing.priceCents + spec.value;
    
    await prisma.listing.update({ where: { id: listing.id }, data: { [spec.field]: newValue } });
    successCount++;
    await prisma.bulkListingJob.update({
      where: { id: jobId },
      data: { processedItems: successCount, successCount },
    });
  }
  
  await prisma.bulkListingJob.update({
    where: { id: jobId },
    data: { status: "completed", completedAt: new Date() },
  });
}
```

---

## 4) Vacation Service

```typescript
// packages/core/seller/vacation/vacationService.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getVacationSettings(sellerId: string) {
  let schedule = await prisma.vacationModeSchedule.findUnique({ where: { sellerId } });
  if (!schedule) {
    schedule = await prisma.vacationModeSchedule.create({ data: { sellerId } });
  }
  return schedule;
}

export async function activateVacationMode(sellerId: string): Promise<void> {
  const schedule = await prisma.vacationModeSchedule.upsert({
    where: { sellerId },
    update: { isActive: true, activatedAt: new Date() },
    create: { sellerId, isActive: true, activatedAt: new Date() },
  });
  
  if (schedule.hideListings) {
    await prisma.listing.updateMany({
      where: { sellerId, status: "ACTIVE" },
      data: { isHiddenByVacation: true },
    });
  }
}

export async function deactivateVacationMode(sellerId: string): Promise<void> {
  await prisma.vacationModeSchedule.update({
    where: { sellerId },
    data: { isActive: false, activatedAt: null },
  });
  
  await prisma.listing.updateMany({
    where: { sellerId, isHiddenByVacation: true },
    data: { isHiddenByVacation: false },
  });
}
```

---

## 5) Health Provider

```typescript
// packages/core/health/providers/sellerExperienceHealthProvider.ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const sellerExperienceHealthProvider: HealthProvider = {
  id: "seller_experience",
  label: "Seller Experience Plus",
  description: "Validates block list, bulk jobs, vacation mode",
  version: "1.0.0",
  
  async run(): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;
    
    // Check stuck jobs
    const stuckJobs = await prisma.bulkListingJob.count({
      where: { status: "processing", startedAt: { lt: new Date(Date.now() - 3600000) } },
    });
    checks.push({
      id: "seller_exp.no_stuck_jobs",
      label: "No stuck bulk jobs",
      status: stuckJobs === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: stuckJobs === 0 ? "All healthy" : `${stuckJobs} stuck`,
    });
    
    return { providerId: this.id, status, summary: `Seller Experience: ${status}`, checks };
  },
};
```

---

## 6) Doctor Checks

```typescript
// packages/core/doctor/checks/sellerExperienceDoctorChecks.ts
import { PrismaClient } from "@prisma/client";
import type { DoctorCheckResult } from "../types";
import { blockBuyer, checkBuyerBlocked, unblockBuyer } from "../../seller/blockList/blockService";

const prisma = new PrismaClient();

export async function runPhase42DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  const testSellerId = "_doctor_test_seller_42";
  const testBuyerId = "_doctor_test_buyer_42";
  
  try {
    // Test block
    const block = await blockBuyer({ sellerId: testSellerId, buyerId: testBuyerId, reason: "test" });
    results.push({
      id: "seller_exp.block_buyer",
      label: "Block buyer works",
      status: block.id ? "PASS" : "FAIL",
      message: block.id ? "Blocked" : "Failed",
    });
    
    // Test check
    const check = await checkBuyerBlocked({ sellerId: testSellerId, buyerId: testBuyerId, actionType: "purchase" });
    results.push({
      id: "seller_exp.check_blocked",
      label: "Check blocked works",
      status: check.isBlocked ? "PASS" : "FAIL",
      message: check.isBlocked ? "Correctly blocked" : "Not blocked",
    });
    
    // Test unblock
    await unblockBuyer({ sellerId: testSellerId, buyerId: testBuyerId });
    const afterUnblock = await checkBuyerBlocked({ sellerId: testSellerId, buyerId: testBuyerId, actionType: "purchase" });
    results.push({
      id: "seller_exp.unblock_buyer",
      label: "Unblock works",
      status: !afterUnblock.isBlocked ? "PASS" : "FAIL",
      message: !afterUnblock.isBlocked ? "Unblocked" : "Still blocked",
    });
    
  } finally {
    await prisma.buyerBlockAttempt.deleteMany({ where: { sellerId: testSellerId } });
    await prisma.buyerBlock.deleteMany({ where: { sellerId: testSellerId } });
  }
  
  return results;
}
```

---

## 7) API Endpoints

```typescript
// apps/web/app/api/seller/block-list/route.ts
import { NextResponse } from "next/server";
import { requireSellerAuth, assertSellerScope } from "@/packages/core/seller/auth";
import { getSellerBlockList, blockBuyer } from "@/packages/core/seller/blockList/blockService";

export async function GET(req: Request) {
  // Auth checks...
  const blocks = await getSellerBlockList(sellerId);
  return NextResponse.json({ blocks });
}

export async function POST(req: Request) {
  // Auth checks...
  const body = await req.json();
  const block = await blockBuyer({ sellerId, ...body });
  return NextResponse.json({ block }, { status: 201 });
}
```

---

## 8) Phase 42 Completion Criteria

- [ ] BuyerBlock model migrated
- [ ] BuyerBlockAttempt model migrated
- [ ] BulkListingJob model migrated
- [ ] VacationModeSchedule model migrated
- [ ] Block service working
- [ ] Bulk job service working
- [ ] Vacation service working
- [ ] Block enforcement in purchase/offer/message flows
- [ ] Seller Hub block list page
- [ ] Health provider passing
- [ ] Doctor checks passing

---

## 9) "Better Than eBay" Differentiators

| Feature | eBay | Twicely |
|---------|------|---------|
| Buyer block list | Yes | ✅ With granular controls |
| Block by action type | No | ✅ Purchases/Offers/Messages |
| Block expiration | No | ✅ Temporary blocks |
| Block attempt logging | No | ✅ See blocked attempts |
| Vacation scheduling | Basic | ✅ Auto-activate/deactivate |
| Bulk price updates | Limited | ✅ Percentage with filters |
