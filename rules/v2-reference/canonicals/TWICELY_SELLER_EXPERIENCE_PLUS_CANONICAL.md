# TWICELY_SELLER_EXPERIENCE_PLUS_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Buyer block list, bulk listing tools, vacation mode scheduling, seller protection features.  
**Audience:** Product, engineering, seller tools, trust & safety, and AI agents.  
**Extends:** `TWICELY_SELLER_HUB_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md`

---

## 1. Purpose

This canonical defines **advanced seller protection and productivity features** for Twicely.

It ensures:
- sellers can block problematic buyers
- blocked buyer actions are logged and prevented
- bulk operations are efficient and auditable
- vacation mode is comprehensive and scheduled
- seller productivity scales with their business

**If behavior is not defined here, it must not exist.**

---

## 2. Core Principles

1. **Sellers have agency over their business**  
   Blocking buyers is a seller right, not a privilege.

2. **Blocks are enforcement, not punishment**  
   Block reasons are internal; buyers are not notified.

3. **Bulk operations are jobs, not transactions**  
   Long-running operations are backgrounded and trackable.

4. **Vacation mode is complete**  
   Listings, promotions, and handling times all respect vacation.

5. **All seller actions are auditable**  
   Protection features cannot be abused silently.

---

## 3. Buyer Block List

### 3.1 Block Model

```ts
type BuyerBlock = {
  id: string;
  sellerId: string;
  buyerId: string;
  reason?: string;           // Internal notes
  reasonCode?: BlockReasonCode;
  orderId?: string;          // Order that triggered block
  
  // Granular blocking
  blockPurchases: boolean;
  blockOffers: boolean;
  blockMessages: boolean;
  
  // Notification
  notifySeller: boolean;     // Alert when blocked buyer attempts action
  
  blockedAt: Date;
  expiresAt?: Date;          // Temporary block
  isActive: boolean;
};

type BlockReasonCode = 
  | "spam"
  | "non_payment"
  | "fraud"
  | "harassment"
  | "excessive_returns"
  | "other";
```

**Rules:**
1. One active block per seller-buyer pair
2. Blocks are seller-private; buyer never sees block
3. Temporary blocks auto-expire
4. Seller cannot block themselves
5. Reason codes are for analytics; free-text reason for details

### 3.2 Block Enforcement

```ts
async function checkBuyerBlocked(args: {
  sellerId: string;
  buyerId: string;
  actionType: "purchase" | "offer" | "message";
}): Promise<BlockCheckResult> {
  const block = await findActiveBlock(args.sellerId, args.buyerId);
  
  if (!block) return { isBlocked: false };
  
  const isBlocked = 
    (args.actionType === "purchase" && block.blockPurchases) ||
    (args.actionType === "offer" && block.blockOffers) ||
    (args.actionType === "message" && block.blockMessages);
  
  if (isBlocked) {
    await logBlockAttempt(block.id, args.actionType);
    if (block.notifySeller) {
      await notifySellerOfBlockedAttempt(block);
    }
  }
  
  return { isBlocked, blockId: isBlocked ? block.id : undefined };
}
```

**Enforcement Points:**
- Checkout: check before payment initiation
- Offers: check before offer creation
- Messages: check before message send

### 3.3 Block Attempt Logging

```ts
type BuyerBlockAttempt = {
  id: string;
  blockId: string;
  buyerId: string;
  sellerId: string;
  attemptType: "purchase" | "offer" | "message";
  attemptedAt: Date;
  listingId?: string;
  metaJson?: Record<string, any>;
};
```

**Purpose:**
- Track blocked buyer persistence
- Inform seller of threat level
- Support escalation to platform trust team

### 3.4 Buyer Experience (When Blocked)

| Action | Buyer Experience |
|--------|------------------|
| Purchase | "This item is currently unavailable" |
| Offer | "Unable to make offer at this time" |
| Message | "Unable to send message" |

**Rules:**
- Never reveal that buyer is blocked
- Generic error messages only
- No "contact support" suggestion

### 3.5 Block Management

```ts
// Block a buyer
async function blockBuyer(args: {
  sellerId: string;
  buyerId: string;
  reason?: string;
  reasonCode?: BlockReasonCode;
  orderId?: string;
  expiresAt?: Date;
}): Promise<BuyerBlock>;

// Unblock a buyer
async function unblockBuyer(args: {
  sellerId: string;
  buyerId: string;
}): Promise<void>;

// Get block list
async function getSellerBlockList(sellerId: string): Promise<BuyerBlock[]>;

// Get block attempts
async function getBlockAttempts(
  sellerId: string,
  since?: Date
): Promise<BuyerBlockAttempt[]>;
```

---

## 4. Bulk Listing Operations

### 4.1 Bulk Job Model

```ts
type BulkListingJob = {
  id: string;
  sellerId: string;
  type: BulkJobType;
  status: BulkJobStatus;
  
  // Input
  sourceFile?: string;       // S3 URL for CSV/Excel
  sourceFormat?: string;     // csv|xlsx|json
  filterJson?: Record<string, any>;
  updateSpec?: BulkUpdateSpec;
  
  // Progress
  totalItems: number;
  processedItems: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  errorsJson: Array<{ row?: number; listingId?: string; error: string }>;
  
  // Output
  resultFile?: string;       // Download link for results
  
  // Timing
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Audit
  requestedByUserId: string;
  cancelledByUserId?: string;
  cancelledAt?: Date;
};

type BulkJobType = 
  | "import"     // Create listings from file
  | "export"     // Export listings to file
  | "update"     // Bulk edit fields
  | "relist"     // Relist ended/sold items
  | "end"        // End multiple listings
  | "delete";    // Delete draft listings

type BulkJobStatus = 
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

type BulkUpdateSpec = {
  field: string;
  operation: "set" | "increment" | "decrement" | "multiply" | "divide";
  value: number | string;
};
```

### 4.2 Bulk Update Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| set | Set to exact value | price = 1000 |
| increment | Add to current | quantity + 5 |
| decrement | Subtract from current | quantity - 3 |
| multiply | Multiply (basis points) | price * 1.1 (10% increase) |
| divide | Divide (basis points) | price / 1.1 (10% decrease) |

**Multiplication/Division:**
- Value in basis points (10000 = 1x)
- 11000 = 1.1x = 10% increase
- 9000 = 0.9x = 10% decrease

### 4.3 Job Processing

```ts
async function processBulkJob(jobId: string): Promise<void> {
  const job = await getBulkJob(jobId);
  if (job.status !== "pending") return;
  
  await updateJobStatus(jobId, "processing");
  
  try {
    const items = await getItemsToProcess(job);
    await updateJobTotal(jobId, items.length);
    
    for (const item of items) {
      try {
        await processItem(job, item);
        await incrementSuccess(jobId);
      } catch (error) {
        await logJobError(jobId, item, error);
        await incrementError(jobId);
      }
    }
    
    await updateJobStatus(jobId, "completed");
  } catch (error) {
    await updateJobStatus(jobId, "failed");
  }
}
```

**Rules:**
1. Jobs run in background (queue-based)
2. Progress is tracked in real-time
3. Errors don't stop job; logged and continued
4. Seller can cancel pending jobs
5. Results available as downloadable report

### 4.4 Filter Specification

```ts
// Example filter for bulk update
{
  status: ["ACTIVE", "PAUSED"],
  categoryId: "category_123",
  createdAfter: "2025-01-01",
  priceAbove: 1000
}
```

**Supported Filters:**
- status
- categoryId
- createdAt range
- price range
- quantity range
- tag

---

## 5. Vacation Mode

### 5.1 Vacation Schedule Model

```ts
type VacationModeSchedule = {
  sellerId: string;
  isActive: boolean;
  activatedAt?: Date;
  
  // Settings
  autoReplyMessage?: string;
  hideListings: boolean;        // Remove from search
  extendHandling: boolean;      // Add days to handling time
  handlingDaysAdd: number;
  pausePromotions: boolean;     // Pause promoted listings
  
  // Schedule
  scheduledStart?: Date;
  scheduledEnd?: Date;
  
  // Reminders
  reminderSentAt?: Date;
  reminderDays: number;         // Days before end to remind
};
```

### 5.2 Vacation Effects

| Effect | When hideListings=true | When hideListings=false |
|--------|------------------------|-------------------------|
| Listing visibility | Hidden from search | Visible but marked |
| New purchases | Not allowed | Allowed with extended handling |
| Offers | Blocked | Allowed |
| Messages | Auto-reply | Auto-reply |
| Promotions | Paused | Continue (if pausePromotions=false) |

### 5.3 Auto-Reply Message

```ts
const DEFAULT_AUTO_REPLY = 
  "Thanks for your message! I'm currently away and will respond when I return. " +
  "Feel free to browse my other listings in the meantime.";
```

**Rules:**
1. Auto-reply sent once per conversation during vacation
2. Seller can customize message
3. Message cannot contain off-platform contact info
4. Max length: 500 characters

### 5.4 Vacation Scheduling

```ts
async function activateVacationMode(sellerId: string): Promise<void> {
  const settings = await getVacationSettings(sellerId);
  
  // Update schedule
  await updateVacationSchedule(sellerId, { isActive: true, activatedAt: new Date() });
  
  // Apply effects
  if (settings.hideListings) {
    await hideSellerListings(sellerId);
  }
  
  if (settings.pausePromotions) {
    await pauseSellerPromotions(sellerId);
  }
}

async function deactivateVacationMode(sellerId: string): Promise<void> {
  // Restore listings
  await unhideSellerListings(sellerId);
  
  // Resume promotions
  await resumeSellerPromotions(sellerId);
  
  // Update schedule
  await updateVacationSchedule(sellerId, { isActive: false, activatedAt: null });
}
```

### 5.5 Scheduled Activation

```ts
// Cron: Every hour
async function processVacationSchedules(): Promise<void> {
  const now = new Date();
  
  // Auto-activate
  const toActivate = await findScheduledToActivate(now);
  for (const schedule of toActivate) {
    await activateVacationMode(schedule.sellerId);
  }
  
  // Auto-deactivate
  const toDeactivate = await findScheduledToDeactivate(now);
  for (const schedule of toDeactivate) {
    await deactivateVacationMode(schedule.sellerId);
  }
  
  // Send reminders
  const toRemind = await findDueForReminder(now);
  for (const schedule of toRemind) {
    await sendVacationEndingReminder(schedule);
  }
}
```

---

## 6. RBAC & Permissions

| Action | Required Permission |
|--------|---------------------|
| Block buyer | settings.block_list.manage |
| View block list | settings.block_list.view |
| View block attempts | settings.block_list.view |
| Create bulk job | listing.bulk_edit |
| Cancel bulk job | listing.bulk_edit |
| View bulk jobs | listing.view |
| Manage vacation mode | settings.vacation.manage |
| View vacation settings | settings.vacation.view |

---

## 7. Health Checks

| Check | Pass Condition |
|-------|----------------|
| No stuck bulk jobs | No jobs in "processing" for >1 hour |
| No duplicate blocks | Max 1 active block per seller-buyer pair |
| Valid vacation dates | scheduledEnd > scheduledStart |
| Vacation cleanup | No active vacation with past scheduledEnd |

---

## 8. Audit Requirements

**Must emit audit events:**
- Buyer blocked/unblocked
- Block attempt logged
- Bulk job created/cancelled/completed
- Vacation mode activated/deactivated
- Vacation settings updated

---

## 9. Integration Points

| System | Integration |
|--------|-------------|
| Checkout Service | Check buyer block before payment |
| Offer Service | Check buyer block before offer creation |
| Message Service | Check buyer block, send auto-reply |
| Search Service | Respect vacation hideListings flag |
| Promotions Service | Respect vacation pausePromotions flag |
| Notification Service | Send vacation reminders |

---

## 10. Out of Scope

- Platform-level buyer bans (see Trust & Safety)
- Seller-to-seller blocking
- Bulk messaging
- Automatic pricing rules (see Promotions)
- Inventory forecasting

---

## 11. Final Rule

Seller experience features must never:
- Reveal blocks to buyers
- Allow bulk operations that bypass validation
- Leave listings in inconsistent state during vacation
- Execute without seller consent

**If behavior is not defined here, it must be rejected or added to this canonical.**
