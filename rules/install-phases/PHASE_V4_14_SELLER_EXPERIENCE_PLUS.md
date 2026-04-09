# V4 Install Phase 14: Seller Experience Plus

**Status:** DRAFT
**Canonical:** `rules/canonicals/34_SELLER_EXPERIENCE_PLUS.md`
**Backend-first:** Schema -> Migration -> Services -> Workers -> Crons -> Integration -> Tests -> UI -> Doctor

> Prereq: V4 Phase 13 complete. V3 tables exist: `buyerBlockList` (social.ts), `sellerProfile` vacation columns (identity.ts), `enforcementAction` with appeal fields (enforcement.ts).

---

## 0. Scope

| Layer | Deliverables |
|-------|-------------|
| Schema | `bulkListingJob`, `vacationModeSchedule`, `buyerBlockAttempt`, `sellerAppeal`; extend `buyerBlockList` |
| Package | Services in `packages/commerce/src/` |
| Workers | 5 BullMQ on-demand workers for bulk operations |
| Crons | 5 BullMQ cron jobs for vacation, block expiry, appeal SLA |
| Integration | Wire block enforcement into offer/cart/message flows |
| Settings | Seed `platform_settings` with all `seller.*` keys |
| Admin UI | `/corp/moderation/appeals`, `/corp/analytics/bulk-jobs`, `/corp/settings/seller-tools` |
| Seller Hub UI | `/hub/listings/bulk`, `/hub/settings/vacation`, `/hub/settings/blocked-buyers`, `/hub/enforcement/appeals` |
| Tests | Unit + integration tests for all services |

---

## 1. Schema Migration

### 1.1 Create `bulkListingJob`

File: `packages/db/src/schema/commerce.ts` (or new file `packages/db/src/schema/seller-tools.ts`)

```typescript
export const bulkListingJob = pgTable('bulk_listing_job', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  jobType:             text('job_type').notNull(),
  status:              text('status').notNull().default('PENDING'),
  sourceFileUrl:       text('source_file_url'),
  sourceFormat:        text('source_format'),
  resultFileUrl:       text('result_file_url'),
  resultFileExpiresAt: timestamp('result_file_expires_at', { withTimezone: true }),
  filterJson:          jsonb('filter_json'),
  updateSpecJson:      jsonb('update_spec_json'),
  totalItems:          integer('total_items').notNull().default(0),
  processedItems:      integer('processed_items').notNull().default(0),
  successCount:        integer('success_count').notNull().default(0),
  errorCount:          integer('error_count').notNull().default(0),
  errorsJson:          jsonb('errors_json').notNull().default('[]'),
  scheduledFor:        timestamp('scheduled_for', { withTimezone: true }),
  startedAt:           timestamp('started_at', { withTimezone: true }),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  requestedByUserId:   text('requested_by_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerStatusIdx:     index('blj_seller_status').on(table.sellerId, table.status),
  statusScheduleIdx:   index('blj_status_schedule').on(table.status, table.scheduledFor),
}));
```

### 1.2 Create `vacationModeSchedule`

```typescript
export const vacationModeSchedule = pgTable('vacation_mode_schedule', {
  id:                     text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:               text('seller_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  isActive:               boolean('is_active').notNull().default(false),
  activatedAt:            timestamp('activated_at', { withTimezone: true }),
  autoReplyMessage:       text('auto_reply_message'),
  hideListings:           boolean('hide_listings').notNull().default(true),
  extendHandling:         boolean('extend_handling').notNull().default(true),
  handlingDaysAdd:        integer('handling_days_add').notNull().default(7),
  pausePromotions:        boolean('pause_promotions').notNull().default(true),
  pauseCrosslister:       boolean('pause_crosslister').notNull().default(true),
  scheduledStart:         timestamp('scheduled_start', { withTimezone: true }),
  scheduledEnd:           timestamp('scheduled_end', { withTimezone: true }),
  reminderSentAt:         timestamp('reminder_sent_at', { withTimezone: true }),
  reminderDaysBeforeEnd:  integer('reminder_days_before_end').notNull().default(2),
  createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:              index('vms_seller').on(table.sellerId),
  activeIdx:              index('vms_active').on(table.isActive, table.scheduledEnd),
}));
```

### 1.3 Create `buyerBlockAttempt`

Add to `packages/db/src/schema/social.ts`:

```typescript
export const buyerBlockAttempt = pgTable('buyer_block_attempt', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  blockId:      text('block_id').notNull().references(() => buyerBlockList.id, { onDelete: 'cascade' }),
  buyerId:      text('buyer_id').notNull(),
  sellerId:     text('seller_id').notNull(),
  attemptType:  text('attempt_type').notNull(),
  listingId:    text('listing_id'),
  attemptedAt:  timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerDateIdx: index('bba_seller_date').on(table.sellerId, table.attemptedAt),
  blockIdx:      index('bba_block').on(table.blockId),
}));
```

### 1.4 Extend `buyerBlockList` (social.ts)

Add columns to existing table:

```typescript
// Add after existing columns
reasonCode:      text('reason_code'),       // 'SPAM' | 'NON_PAYMENT' | 'FRAUD' | 'HARASSMENT' | 'OTHER'
blockPurchases:  boolean('block_purchases').notNull().default(true),
blockOffers:     boolean('block_offers').notNull().default(true),
blockMessages:   boolean('block_messages').notNull().default(true),
expiresAt:       timestamp('expires_at', { withTimezone: true }),
```

### 1.5 Create `sellerAppeal`

Add to `packages/db/src/schema/enforcement.ts`:

```typescript
export const sellerAppeal = pgTable('seller_appeal', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  enforcementActionId:   text('enforcement_action_id').notNull()
    .references(() => enforcementAction.id, { onDelete: 'cascade' }),
  sellerId:              text('seller_id').notNull()
    .references(() => user.id, { onDelete: 'restrict' }),
  appealNote:            text('appeal_note').notNull(),
  appealCategory:        text('appeal_category').notNull(),
  evidenceUrls:          text('evidence_urls').array().notNull().default(sql`'{}'::text[]`),
  status:                text('status').notNull().default('SUBMITTED'),
  slaDeadlineAt:         timestamp('sla_deadline_at', { withTimezone: true }).notNull(),
  slaBreach:             boolean('sla_breach').notNull().default(false),
  assignedStaffId:       text('assigned_staff_id'),
  reviewNote:            text('review_note'),
  reviewedAt:            timestamp('reviewed_at', { withTimezone: true }),
  escalatedToStaffId:    text('escalated_to_staff_id'),
  escalatedAt:           timestamp('escalated_at', { withTimezone: true }),
  escalationReason:      text('escalation_reason'),
  resolutionType:        text('resolution_type'),
  resolvedAt:            timestamp('resolved_at', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:             index('sa_seller').on(table.sellerId),
  statusIdx:             index('sa_status').on(table.status),
  slaIdx:                index('sa_sla').on(table.slaDeadlineAt, table.slaBreach),
  actionIdx:             index('sa_action').on(table.enforcementActionId),
}));
```

### 1.6 Add `isHiddenByVacation` to listings table

In `packages/db/src/schema/listings.ts`, add:
```typescript
isHiddenByVacation: boolean('is_hidden_by_vacation').notNull().default(false),
```

### 1.7 Export and migrate

Add all new tables + column additions to `packages/db/src/schema/index.ts`. Run `npx drizzle-kit generate`.

---

## 2. Services

### Step 2.1: Bulk Listing Service

File: `packages/commerce/src/bulk-listing-service.ts`

```typescript
import { db } from '@twicely/db';
import { bulkListingJob, listing } from '@twicely/db/schema';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export async function createBulkJob(input: {
  sellerId: string;
  jobType: 'IMPORT' | 'EXPORT' | 'PRICE_UPDATE' | 'RELIST' | 'END' | 'PAUSE';
  requestedByUserId: string;
  sourceFileUrl?: string;
  sourceFormat?: string;
  filterJson?: Record<string, unknown>;
  updateSpecJson?: { field: string; operation: string; value: number };
  scheduledFor?: Date;
}): Promise<{ id: string }> {
  const maxConcurrent = await getPlatformSetting<number>('seller.bulk.maxConcurrentJobs', 2);
  // Check concurrent job limit for this seller
  // Validate input based on jobType
  // Create bulkListingJob row
  // Queue BullMQ job
  // Return job ID
}

export async function processBulkImport(jobId: string): Promise<void> {
  // Update status to PROCESSING, set startedAt
  // Download source file from S3
  // Parse CSV/JSON based on sourceFormat
  // For each row:
  //   Validate required fields (title, priceCents, categorySlug, condition)
  //   Validate priceCents >= seller.bulk.minPriceCents
  //   Create draft listing
  //   Increment processedItems, successCount
  //   On error: log to errorsJson, increment errorCount
  // Update status to COMPLETED/FAILED, set completedAt
}

export async function processBulkExport(jobId: string): Promise<void> {
  // Update status to PROCESSING
  // Query listings matching filterJson for this seller
  // Generate CSV with columns: id, title, description, priceCents, categorySlug, condition, brand, size, status, createdAt
  // Upload to S3
  // Set resultFileUrl with signed URL, set resultFileExpiresAt (TTL from seller.bulk.exportTtlHours)
  // Update status to COMPLETED
}

export async function processBulkPriceUpdate(jobId: string): Promise<void> {
  // Update status to PROCESSING
  // Query listings matching filterJson
  // Set totalItems
  // For each listing:
  //   Calculate new price based on operation (MULTIPLY_BPS, ADD_CENTS, SET_CENTS)
  //   Validate new price >= seller.bulk.minPriceCents and > 0
  //   Update listing.priceCents
  //   Call recordPriceChange(listingId, newPrice, 'bulk_update')
  //   Call checkPriceAlertsForListing(listingId, newPrice)
  //   Increment counts
  // Update status to COMPLETED
}

export async function processBulkRelist(jobId: string): Promise<void> {
  // Query ENDED/PAUSED listings matching filterJson
  // For each: set status to ACTIVE, update searchable fields
  // Record counts
}

export async function processBulkEnd(jobId: string): Promise<void> {
  // Query ACTIVE listings matching filterJson
  // For each: set status to ENDED
  // Record counts
}

export async function cancelBulkJob(jobId: string, userId: string): Promise<void> {
  // Only cancel PENDING jobs
  // Verify seller ownership
  // Set status to CANCELED
}

export async function getSellerBulkJobs(
  sellerId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: Array<unknown>; total: number }> {
  // Paginated query ordered by createdAt DESC
}
```

### Step 2.2: Vacation Mode Service

File: `packages/commerce/src/vacation-mode-service.ts`

```typescript
export async function getVacationSettings(sellerId: string): Promise<VacationModeScheduleRow | null> {
  // Get or create vacationModeSchedule for seller
}

export async function updateVacationSettings(sellerId: string, input: {
  hideListings?: boolean;
  extendHandling?: boolean;
  handlingDaysAdd?: number;
  pausePromotions?: boolean;
  pauseCrosslister?: boolean;
  autoReplyMessage?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  reminderDaysBeforeEnd?: number;
}): Promise<void> {
  // Validate handlingDaysAdd <= seller.vacation.maxHandlingDaysAdd
  // Validate scheduledStart <= now + seller.vacation.maxScheduleAheadDays
  // Validate autoReplyMessage length <= seller.vacation.autoReplyMaxChars
  // Upsert vacationModeSchedule
}

export async function activateVacationMode(sellerId: string): Promise<void> {
  const schedule = await getVacationSettings(sellerId);
  // Set schedule.isActive = true, activatedAt = now
  // Update sellerProfile: vacationMode = true, vacationStartAt = now,
  //   vacationEndAt = schedule.scheduledEnd, vacationModeType from flags
  // If hideListings: UPDATE listing SET isHiddenByVacation = true WHERE sellerId AND status = 'ACTIVE'
  // If pausePromotions: UPDATE promotion SET isPaused = true WHERE sellerId AND isActive = true
  // If pauseCrosslister: flag crosslister scheduler to skip this seller
  // Update storefront: vacationMode = true, vacationMessage = schedule.autoReplyMessage
}

export async function deactivateVacationMode(sellerId: string): Promise<void> {
  // Set schedule.isActive = false
  // Update sellerProfile: vacationMode = false, clear vacation fields
  // UPDATE listing SET isHiddenByVacation = false WHERE sellerId AND isHiddenByVacation = true
  // Unpause promotions
  // Resume crosslister
  // Clear storefront vacation banner
}

export async function processScheduledActivations(): Promise<number> {
  // Query vacationModeSchedule WHERE isActive = false AND scheduledStart <= now AND scheduledEnd > now
  // For each: activateVacationMode(sellerId)
  // Return count
}

export async function processScheduledDeactivations(): Promise<number> {
  // Already partially covered by V3's processVacationAutoEnd()
  // Additionally deactivate vacationModeSchedule rows
  // Return count
}

export async function sendVacationReminders(): Promise<number> {
  // Query active schedules WHERE scheduledEnd - reminderDaysBeforeEnd <= now AND reminderSentAt IS NULL
  // For each: notify(sellerId, 'seller.vacation.endingSoon', {...})
  // Set reminderSentAt
  // Return count
}
```

### Step 2.3: Enhanced Buyer Block Service

File: `packages/commerce/src/buyer-block-service.ts` (extend existing `buyer-block.ts`)

```typescript
export async function blockBuyer(input: {
  sellerId: string;
  buyerId: string;
  reason?: string;
  reasonCode?: string;
  blockPurchases?: boolean;
  blockOffers?: boolean;
  blockMessages?: boolean;
  expiresAt?: Date;
}): Promise<{ id: string }> {
  const maxPerSeller = await getPlatformSetting<number>('seller.block.maxPerSeller', 500);
  // Prevent self-block
  // Check limit
  // Upsert buyerBlockList with new columns
}

export async function unblockBuyer(sellerId: string, buyerId: string): Promise<void> {
  // DELETE from buyerBlockList WHERE blockerId = sellerId AND blockedId = buyerId
}

export async function isBuyerBlockedForAction(
  sellerId: string,
  buyerId: string,
  actionType: 'PURCHASE' | 'OFFER' | 'MESSAGE'
): Promise<{ isBlocked: boolean; blockId?: string }> {
  // Query buyerBlockList WHERE blockerId AND blockedId AND (expiresAt IS NULL OR expiresAt > now)
  // Check action-specific flag (blockPurchases/blockOffers/blockMessages)
  // If blocked: create buyerBlockAttempt record
  // Return result
}

export async function getSellerBlockList(
  sellerId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: Array<unknown>; total: number }> {
  // Paginated query with blocked user info + attempt count subquery
}

export async function getBlockAttempts(
  sellerId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: Array<unknown>; total: number }> {
  // Paginated buyerBlockAttempt query ordered by attemptedAt DESC
}

export async function expireBlocks(): Promise<number> {
  // DELETE buyerBlockList WHERE expiresAt <= now
  // Return count
}
```

### Step 2.4: Seller Appeal Service

File: `packages/commerce/src/seller-appeal-service.ts`

```typescript
export async function submitAppeal(input: {
  enforcementActionId: string;
  sellerId: string;
  appealNote: string;
  appealCategory: string;
  evidenceUrls?: string[];
}): Promise<{ id: string }> {
  const windowDays = await getPlatformSetting<number>('seller.appeal.windowDays', 30);
  const slaHours = await getPlatformSetting<number>('seller.appeal.slaHours', 48);
  const maxEvidence = await getPlatformSetting<number>('seller.appeal.maxEvidenceFiles', 5);

  // Verify enforcement action exists and belongs to seller
  // Verify action was created within windowDays
  // Verify no existing appeal for this action (one appeal per action)
  // Verify action type is appealable (not COACHING)
  // Validate evidence count <= maxEvidence
  // Calculate slaDeadlineAt = now + slaHours
  // Create sellerAppeal row
  // Update enforcementAction.status to APPEALED
  // Notify staff queue
  // Return appeal ID
}

export async function getAppealableActions(sellerId: string): Promise<Array<unknown>> {
  // Query enforcementAction WHERE userId = sellerId
  //   AND status IN ('ACTIVE', 'EXPIRED')
  //   AND actionType != 'COACHING'
  //   AND createdAt >= now - windowDays
  //   AND no existing sellerAppeal
}

export async function getSellerAppeals(
  sellerId: string,
  page: number = 1
): Promise<{ items: Array<unknown>; total: number }> {
  // Paginated query with enforcement action details
}

export async function reviewAppeal(input: {
  appealId: string;
  staffId: string;
  decision: 'APPROVED' | 'DENIED' | 'ESCALATED';
  reviewNote: string;
  escalationReason?: string;
}): Promise<void> {
  // Update sellerAppeal status
  // If APPROVED:
  //   Set resolutionType = 'OVERTURNED', resolvedAt = now
  //   Update enforcementAction.status = 'APPEAL_APPROVED'
  //   Lift restrictions on sellerProfile
  //   Notify seller: enforcement.appeal.decided (approved)
  // If DENIED:
  //   Set resolutionType = 'UPHELD', resolvedAt = now
  //   Notify seller: enforcement.appeal.decided (denied)
  // If ESCALATED:
  //   Set escalatedToStaffId, escalatedAt, escalationReason
  //   Recalculate slaDeadlineAt from now + slaHours
  //   Notify senior staff: enforcement.appeal.escalated
}

export async function getAppealQueue(
  status?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: Array<unknown>; total: number }> {
  // Staff-facing paginated queue
  // Include SLA status (OK, WARNING if < 6h remaining, BREACH)
}

export async function checkAppealSla(): Promise<number> {
  // Query sellerAppeal WHERE status IN ('SUBMITTED', 'UNDER_REVIEW')
  //   AND slaDeadlineAt <= now AND slaBreach = false
  // For each: set slaBreach = true, auto-escalate, notify lead
  // Return count
}
```

---

## 3. BullMQ Workers

### 3.1 On-demand workers (packages/jobs/src/workers/)

- `bulk-import-worker.ts` -- calls `processBulkImport(jobId)`
- `bulk-export-worker.ts` -- calls `processBulkExport(jobId)`
- `bulk-price-update-worker.ts` -- calls `processBulkPriceUpdate(jobId)`
- `bulk-relist-worker.ts` -- calls `processBulkRelist(jobId)`
- `bulk-end-worker.ts` -- calls `processBulkEnd(jobId)`

All bulk workers should:
- Use `registerShutdown(() => worker.close())` for clean SIGTERM handling
- Update job progress incrementally (processedItems)
- Handle errors per-item without failing the entire job
- Set final status to COMPLETED if errorCount < totalItems, FAILED if errorCount === totalItems

### 3.2 Cron registration (packages/jobs/src/cron-jobs.ts)

```typescript
// Seller Experience Plus crons
{ name: 'vacation-auto-activate', pattern: '*/15 * * * *', tz: 'UTC' },
{ name: 'vacation-auto-end', pattern: '*/15 * * * *', tz: 'UTC' },  // extends V3's processVacationAutoEnd
{ name: 'vacation-reminder', pattern: '0 9 * * *', tz: 'UTC' },
{ name: 'block-expiry', pattern: '0 * * * *', tz: 'UTC' },
{ name: 'appeal-sla-check', pattern: '*/30 * * * *', tz: 'UTC' },
```

Workers:
- `vacation-activate-worker.ts` -- calls `processScheduledActivations()`
- `vacation-end-worker.ts` -- calls `processScheduledDeactivations()` (augments V3's `processVacationAutoEnd`)
- `vacation-reminder-worker.ts` -- calls `sendVacationReminders()`
- `block-expiry-worker.ts` -- calls `expireBlocks()`
- `appeal-sla-worker.ts` -- calls `checkAppealSla()`

---

## 4. Integration Points

### 4.1 Block enforcement in commerce flows

**Offer creation** (`packages/commerce/src/offer-create.ts`):
```typescript
// Before creating offer, after existing checks:
const blockCheck = await isBuyerBlockedForAction(listing.ownerUserId, buyerId, 'OFFER');
if (blockCheck.isBlocked) {
  throw new Error('BUYER_BLOCKED');
}
```

**Cart add** (wherever cart-add logic lives):
```typescript
const blockCheck = await isBuyerBlockedForAction(sellerId, buyerId, 'PURCHASE');
if (blockCheck.isBlocked) {
  throw new Error('BUYER_BLOCKED');
}
```

**Order creation** (`packages/commerce/src/create-order.ts`):
```typescript
// Before order creation:
const blockCheck = await isBuyerBlockedForAction(sellerId, buyerId, 'PURCHASE');
if (blockCheck.isBlocked) {
  throw new Error('BUYER_BLOCKED');
}
```

**Messaging** (in message-send flow):
```typescript
const blockCheck = await isBuyerBlockedForAction(recipientSellerId, senderBuyerId, 'MESSAGE');
if (blockCheck.isBlocked) {
  // Silently drop message or return generic error
}
```

### 4.2 Bulk price update -> Price alerts

When `processBulkPriceUpdate` changes a listing price, it calls:
1. `recordPriceChange(listingId, newPriceCents, 'bulk_update')` -- from Phase 13 price history service
2. `checkPriceAlertsForListing(listingId, newPriceCents)` -- from Phase 13 price alert service

### 4.3 Vacation mode -> Search exclusion

Search queries (Typesense) must filter out listings where `isHiddenByVacation = true`. This requires syncing the field to the Typesense schema. Add `isHiddenByVacation` as a boolean filter field in `packages/search/src/typesense-schema.ts`.

### 4.4 Vacation mode -> Storefront banner

The storefront page (`/seller/:slug`) reads `sellerProfile.vacationMode` and shows a banner with the auto-reply message.

---

## 5. Seed Platform Settings

```typescript
const SELLER_EXP_SETTINGS = [
  // Bulk operations
  { key: 'seller.bulk.maxItemsPerJob', value: '5000', type: 'number' },
  { key: 'seller.bulk.maxConcurrentJobs', value: '2', type: 'number' },
  { key: 'seller.bulk.minPriceCents', value: '100', type: 'number' },
  { key: 'seller.bulk.exportTtlHours', value: '48', type: 'number' },
  { key: 'seller.bulk.importMaxFileSizeMb', value: '50', type: 'number' },
  // Vacation
  { key: 'seller.vacation.maxHandlingDaysAdd', value: '14', type: 'number' },
  { key: 'seller.vacation.maxScheduleAheadDays', value: '90', type: 'number' },
  { key: 'seller.vacation.reminderDaysDefault', value: '2', type: 'number' },
  { key: 'seller.vacation.autoReplyMaxChars', value: '500', type: 'number' },
  // Block list
  { key: 'seller.block.maxPerSeller', value: '500', type: 'number' },
  { key: 'seller.block.attemptLogRetentionDays', value: '90', type: 'number' },
  // Appeals
  { key: 'seller.appeal.slaHours', value: '48', type: 'number' },
  { key: 'seller.appeal.windowDays', value: '30', type: 'number' },
  { key: 'seller.appeal.maxEvidenceFiles', value: '5', type: 'number' },
  { key: 'seller.appeal.maxEvidenceFileSizeMb', value: '10', type: 'number' },
];
```

---

## 6. CASL Permissions

Add to `packages/casl/src/buyer-abilities.ts` (seller-as-user abilities):
```typescript
// Seller actions (user has sellerProfile)
can('create', 'BulkListingJob', { sellerId: user.id });
can('read', 'BulkListingJob', { sellerId: user.id });
can('cancel', 'BulkListingJob', { sellerId: user.id, status: 'PENDING' });
can('manage', 'VacationModeSchedule', { sellerId: user.id });
can('create', 'BuyerBlock', { blockerId: user.id });
can('delete', 'BuyerBlock', { blockerId: user.id });
can('read', 'BuyerBlockAttempt', { sellerId: user.id });
can('create', 'SellerAppeal', { sellerId: user.id });
can('read', 'SellerAppeal', { sellerId: user.id });
```

Add to staff abilities:
```typescript
if (hasRole('MODERATION') || hasRole('ADMIN') || hasRole('SUPER_ADMIN')) {
  can('manage', 'SellerAppeal');
}
if (hasRole('SUPPORT') || hasRole('ADMIN')) {
  can('read', 'BulkListingJob');
  can('read', 'SellerAppeal');
}
```

---

## 7. Notification Templates

Register these templates in `packages/notifications/src/templates.ts`:

| Template Key | Channel | Variables |
|-------------|---------|-----------|
| `seller.vacation.endingSoon` | IN_APP, EMAIL | `{daysRemaining, scheduledEnd}` |
| `seller.vacation.activated` | IN_APP | `{scheduledEnd}` |
| `seller.vacation.deactivated` | IN_APP | `{}` |
| `seller.block.attemptLogged` | IN_APP | `{buyerName, attemptType, listingTitle}` |
| `enforcement.appeal.submitted` | IN_APP (staff) | `{sellerName, actionType, appealCategory}` |
| `enforcement.appeal.decided` | IN_APP, EMAIL | `{decision, reviewNote}` |
| `enforcement.appeal.escalated` | IN_APP (staff) | `{sellerName, escalationReason}` |
| `enforcement.appeal.slaBreach` | IN_APP (staff) | `{appealId, hoursOverdue}` |
| `seller.bulk.completed` | IN_APP | `{jobType, successCount, errorCount, downloadUrl}` |
| `seller.bulk.failed` | IN_APP | `{jobType, errorCount}` |

---

## 8. Tests

### Unit tests (`packages/commerce/src/__tests__/`)

- `bulk-listing-service.test.ts` (10+ tests):
  - Creates import job
  - Creates export job with signed URL
  - Processes price update with MULTIPLY_BPS
  - Processes price update with ADD_CENTS
  - Rejects price update below minimum
  - Processes bulk relist
  - Processes bulk end
  - Enforces concurrent job limit
  - Cancels pending job
  - Rejects cancel of processing job

- `vacation-mode-service.test.ts` (8+ tests):
  - Saves vacation settings
  - Activates vacation mode (hides listings)
  - Activates vacation mode (extends handling)
  - Deactivates and restores listings
  - Processes scheduled activation
  - Processes scheduled deactivation
  - Sends reminder before end
  - Validates max handling days

- `buyer-block-service.test.ts` (8+ tests):
  - Blocks buyer with all action types
  - Prevents self-block
  - Enforces max blocks per seller
  - Checks purchase block correctly
  - Checks offer block correctly
  - Checks message block correctly
  - Logs blocked attempt
  - Expires time-limited blocks

- `seller-appeal-service.test.ts` (8+ tests):
  - Submits appeal successfully
  - Rejects appeal outside window
  - Rejects duplicate appeal
  - Rejects appeal on coaching action
  - Staff approves appeal (lifts restriction)
  - Staff denies appeal
  - Staff escalates appeal
  - SLA breach detection

---

## 9. Seller Hub UI

### 9.1 `/hub/listings/bulk`
- Job type selector: Import, Export, Price Update, Relist, End
- **Import tab**: File upload (CSV/JSON), format selector, preview first 5 rows, submit
- **Export tab**: Filter builder (status, category, brand, price range), download button
- **Price Update tab**: Filter builder + operation selector (multiply/add/set) + value input + preview affected count
- **Relist/End tab**: Filter builder + confirmation
- Job history table: type, status, progress bar, created, completed, download link

### 9.2 `/hub/settings/vacation`
- Preset buttons: "Hard Away", "Soft Away", "Away-but-Open"
- Custom toggle overrides: hideListings, extendHandling, pausePromotions, pauseCrosslister
- Handling days slider (1-14)
- Auto-reply message textarea (with char count)
- Schedule: start date/time picker, end date/time picker
- Reminder days before end selector
- Current status indicator (active/scheduled/off)
- Activate/Deactivate button

### 9.3 `/hub/settings/blocked-buyers`
- Blocked buyers table: username, reason code, blocked actions, blocked date, expires
- "Block Buyer" button with modal: search by username, reason, action flags, optional expiry
- Unblock action
- Attempt log tab: buyer, action type, listing, timestamp

### 9.4 `/hub/enforcement/appeals`
- Appealable actions list: action type, date, reason, status
- "Appeal" button opens form: category selector, note textarea, evidence upload (drag-and-drop)
- Appeal status tracker: Submitted -> Under Review -> Decision
- Past appeals list with outcomes

---

## 10. Admin UI

### 10.1 `/corp/moderation/appeals`
- Appeal queue table: seller, action type, category, submitted, SLA status (green/yellow/red)
- Filters: status, SLA status, category
- Click to review: full appeal details, enforcement action context, evidence gallery
- Decision buttons: Approve, Deny, Escalate (each requires note)

### 10.2 `/corp/analytics/bulk-jobs`
- Aggregate stats: jobs today, success rate, avg processing time
- Job table: seller, type, status, items, errors, duration
- Stuck job alerts (PROCESSING for > 1 hour)

### 10.3 `/corp/settings/seller-tools`
- Bulk operation limits (max items, max concurrent, min price)
- Vacation mode limits (max handling days, max schedule ahead)
- Block list limits
- Appeal SLA and window settings

---

## 11. Completion Criteria

- [ ] `bulkListingJob` table created with migration
- [ ] `vacationModeSchedule` table created with migration
- [ ] `buyerBlockAttempt` table created with migration
- [ ] `sellerAppeal` table created with migration
- [ ] `buyerBlockList` extended with V4 columns
- [ ] `listing.isHiddenByVacation` column added
- [ ] Bulk listing service: import, export, price update, relist, end, cancel
- [ ] 5 BullMQ workers for bulk operations
- [ ] Vacation mode service: activate, deactivate, schedule, remind
- [ ] 3 vacation cron jobs
- [ ] Enhanced buyer block service: granular actions, attempts, expiry
- [ ] Seller appeal service: submit, review, escalate, SLA check
- [ ] Block enforcement wired into offer, cart, order, message flows
- [ ] `isHiddenByVacation` synced to Typesense schema
- [ ] Platform settings seeded (16 keys)
- [ ] CASL permissions added for all new subjects
- [ ] Notification templates registered (10 templates)
- [ ] Seller Hub UI: bulk operations, vacation settings, blocked buyers, appeals
- [ ] Admin UI: appeal queue, bulk job monitoring, seller tool settings
- [ ] All unit tests green (34+ new tests)
- [ ] `npx turbo typecheck` passes
- [ ] `npx turbo test` baseline maintained
