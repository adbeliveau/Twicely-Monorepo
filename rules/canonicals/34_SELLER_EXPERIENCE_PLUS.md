# V4 Canonical 34: Seller Experience Plus

**Version:** v4.0 | **Date:** 2026-04-09 | **Status:** DRAFT
**Domain:** Commerce / Seller Tools / Enforcement
**Depends on:** `packages/db/src/schema/social.ts` (buyerBlockList), `packages/db/src/schema/identity.ts` (sellerProfile vacation fields), `packages/db/src/schema/enforcement.ts` (enforcementAction appeal fields), `packages/commerce/src/buyer-block.ts`, `packages/commerce/src/vacation-cron.ts`

---

## 1. OVERVIEW

V3 already has core seller experience primitives. This canonical defines V4 enhancements:

### Already built in V3 (DO NOT rebuild):
- **Buyer block list** -- `buyerBlockList` table in social.ts, `buyer-block.ts` service (`isBuyerBlocked`, `getBlockedBuyerCount`)
- **Vacation mode** -- `sellerProfile` columns: `vacationMode`, `vacationMessage`, `vacationStartAt`, `vacationEndAt`, `vacationModeType`, `vacationAutoReplyMessage`
- **Vacation auto-end cron** -- `vacation-cron.ts` (`processVacationAutoEnd`)
- **Enforcement actions with appeals** -- `enforcementAction` table with `appealNote`, `appealEvidenceUrls`, `appealedAt`, `appealReviewedByStaffId`, `appealResolvedAt`
- **Content reports** -- `contentReport` table with full moderation workflow

### V4 adds:
1. **Bulk listing operations** -- Import from CSV/JSON, export to CSV, bulk price update, bulk relist, bulk end
2. **Enhanced seller appeals workflow** -- Structured appeal form, evidence upload, staff review queue, escalation path, SLA tracking
3. **Enhanced vacation mode** -- Scheduled start/end, listing behavior flags, promotion pause, auto-reply customization, re-activation reminder
4. **Buyer block enhancements** -- Block reason codes, block attempt logging, granular action-type blocking, expiring blocks

---

## 2. INVARIANTS

1. **All money in integer cents.** Bulk price updates use cents or basis-point multipliers.
2. **All limits from `platform_settings`.** Max blocks per seller, max bulk job items, vacation handling days.
3. **Buyer blocks are seller-scoped.** A block from seller A does not affect buyer's interactions with seller B.
4. **Bulk jobs are async.** All bulk operations run in BullMQ workers, never in the request path.
5. **Vacation mode is seller-initiated.** Staff cannot force vacation mode (they use enforcement actions instead).
6. **Appeals have a single-attempt limit by default.** One appeal per enforcement action unless escalated by staff.
7. **Bulk import validates every row.** Invalid rows are logged in errorsJson, not silently dropped.
8. **Export files are S3-signed URLs with configurable TTL.** Never public permanent links.

---

## 3. SCHEMA

### 3.1 New: `bulkListingJob`

```typescript
export const bulkListingJob = pgTable('bulk_listing_job', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:         text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  jobType:          text('job_type').notNull(),  // 'IMPORT' | 'EXPORT' | 'PRICE_UPDATE' | 'RELIST' | 'END' | 'PAUSE'
  status:           text('status').notNull().default('PENDING'),  // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED'
  // Import-specific
  sourceFileUrl:    text('source_file_url'),      // S3 URL of uploaded CSV/JSON
  sourceFormat:     text('source_format'),         // 'CSV' | 'JSON' | 'TWICELY_EXPORT'
  // Export-specific
  resultFileUrl:    text('result_file_url'),       // S3 signed URL for download
  resultFileExpiresAt: timestamp('result_file_expires_at', { withTimezone: true }),
  // Filter (which listings to operate on)
  filterJson:       jsonb('filter_json'),          // {status: 'ACTIVE', categoryId: '...', brand: '...', priceMin: ..., priceMax: ...}
  // Update spec (for PRICE_UPDATE)
  updateSpecJson:   jsonb('update_spec_json'),     // {field: 'priceCents', operation: 'MULTIPLY_BPS' | 'ADD_CENTS' | 'SET_CENTS', value: number}
  // Progress
  totalItems:       integer('total_items').notNull().default(0),
  processedItems:   integer('processed_items').notNull().default(0),
  successCount:     integer('success_count').notNull().default(0),
  errorCount:       integer('error_count').notNull().default(0),
  errorsJson:       jsonb('errors_json').notNull().default('[]'),  // [{row: number, listingId?: string, error: string}]
  // Scheduling
  scheduledFor:     timestamp('scheduled_for', { withTimezone: true }),
  startedAt:        timestamp('started_at', { withTimezone: true }),
  completedAt:      timestamp('completed_at', { withTimezone: true }),
  // Audit
  requestedByUserId: text('requested_by_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerStatusIdx:  index('blj_seller_status').on(table.sellerId, table.status),
  statusScheduleIdx: index('blj_status_schedule').on(table.status, table.scheduledFor),
}));
```

### 3.2 New: `vacationModeSchedule`

```typescript
export const vacationModeSchedule = pgTable('vacation_mode_schedule', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:          text('seller_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  isActive:          boolean('is_active').notNull().default(false),
  activatedAt:       timestamp('activated_at', { withTimezone: true }),
  // Auto-reply
  autoReplyMessage:  text('auto_reply_message'),  // max 500 chars
  // Listing behavior flags
  hideListings:      boolean('hide_listings').notNull().default(true),
  extendHandling:    boolean('extend_handling').notNull().default(true),
  handlingDaysAdd:   integer('handling_days_add').notNull().default(7),
  pausePromotions:   boolean('pause_promotions').notNull().default(true),
  // Pause crosslister sync
  pauseCrosslister:  boolean('pause_crosslister').notNull().default(true),
  // Schedule
  scheduledStart:    timestamp('scheduled_start', { withTimezone: true }),
  scheduledEnd:      timestamp('scheduled_end', { withTimezone: true }),
  // Reminders
  reminderSentAt:    timestamp('reminder_sent_at', { withTimezone: true }),
  reminderDaysBeforeEnd: integer('reminder_days_before_end').notNull().default(2),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:         index('vms_seller').on(table.sellerId),
  activeIdx:         index('vms_active').on(table.isActive, table.scheduledEnd),
}));
```

**Relationship to sellerProfile.vacationMode:** The `sellerProfile` columns remain the source of truth for "is this seller on vacation right now?" The `vacationModeSchedule` table adds the scheduling, flags, and auto-reply configuration. When vacation activates:
1. `sellerProfile.vacationMode = true`, `vacationStartAt = now`, `vacationEndAt = schedule.scheduledEnd`
2. `sellerProfile.vacationModeType` set from flag combination (see Section 5)
3. `vacationModeSchedule.isActive = true`

### 3.3 Extend: `buyerBlockList` (social.ts)

Add columns to existing table:

| Column | Type | Purpose |
|--------|------|---------|
| `reasonCode` | `text` | `'SPAM'`, `'NON_PAYMENT'`, `'FRAUD'`, `'HARASSMENT'`, `'OTHER'` |
| `blockPurchases` | `boolean default true` | Block from purchasing |
| `blockOffers` | `boolean default true` | Block from making offers |
| `blockMessages` | `boolean default true` | Block from sending messages |
| `expiresAt` | `timestamp` | Optional auto-expiry |

### 3.4 New: `buyerBlockAttempt`

```typescript
export const buyerBlockAttempt = pgTable('buyer_block_attempt', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  blockId:      text('block_id').notNull().references(() => buyerBlockList.id, { onDelete: 'cascade' }),
  buyerId:      text('buyer_id').notNull(),
  sellerId:     text('seller_id').notNull(),
  attemptType:  text('attempt_type').notNull(),  // 'PURCHASE' | 'OFFER' | 'MESSAGE'
  listingId:    text('listing_id'),
  attemptedAt:  timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerDateIdx: index('bba_seller_date').on(table.sellerId, table.attemptedAt),
  blockIdx:      index('bba_block').on(table.blockId),
}));
```

### 3.5 New: `sellerAppeal` (structured appeals)

The existing `enforcementAction` table has inline appeal fields. V4 extracts this into a dedicated table for richer workflow:

```typescript
export const sellerAppeal = pgTable('seller_appeal', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  enforcementActionId:  text('enforcement_action_id').notNull().references(() => enforcementAction.id, { onDelete: 'cascade' }),
  sellerId:             text('seller_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  // Appeal content
  appealNote:           text('appeal_note').notNull(),
  appealCategory:       text('appeal_category').notNull(),  // 'POLICY_MISUNDERSTANDING' | 'INCORRECT_DATA' | 'TECHNICAL_ERROR' | 'EXTENUATING_CIRCUMSTANCES' | 'OTHER'
  evidenceUrls:         text('evidence_urls').array().notNull().default(sql`'{}'::text[]`),
  // Status
  status:               text('status').notNull().default('SUBMITTED'),  // 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED' | 'ESCALATED'
  // SLA tracking
  slaDeadlineAt:        timestamp('sla_deadline_at', { withTimezone: true }).notNull(),
  slaBreach:            boolean('sla_breach').notNull().default(false),
  // Staff review
  assignedStaffId:      text('assigned_staff_id'),
  reviewNote:           text('review_note'),
  reviewedAt:           timestamp('reviewed_at', { withTimezone: true }),
  // Escalation
  escalatedToStaffId:   text('escalated_to_staff_id'),
  escalatedAt:          timestamp('escalated_at', { withTimezone: true }),
  escalationReason:     text('escalation_reason'),
  // Final resolution
  resolutionType:       text('resolution_type'),  // 'UPHELD' | 'OVERTURNED' | 'MODIFIED' | 'WITHDRAWN'
  resolvedAt:           timestamp('resolved_at', { withTimezone: true }),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:     index('sa_seller').on(table.sellerId),
  statusIdx:     index('sa_status').on(table.status),
  slaIdx:        index('sa_sla').on(table.slaDeadlineAt, table.slaBreach),
  actionIdx:     index('sa_action').on(table.enforcementActionId),
}));
```

---

## 4. BULK LISTING SERVICES

### 4.1 Bulk Job Service

Lives in `packages/commerce/src/bulk-listing-service.ts`.

Key functions:
- `createBulkJob(sellerId, jobType, options)` -- creates job record, validates seller quota, uploads source file to S3 if import
- `processBulkImport(jobId)` -- BullMQ worker; parses CSV/JSON, validates each row (title, price, category required), creates draft listings, records errors
- `processBulkExport(jobId)` -- BullMQ worker; queries seller's listings with filter, generates CSV, uploads to S3, sets signed URL with TTL
- `processBulkPriceUpdate(jobId)` -- BullMQ worker; applies update spec to filtered listings, records price history for each change
- `processBulkRelist(jobId)` -- BullMQ worker; reactivates ended/paused listings matching filter
- `processBulkEnd(jobId)` -- BullMQ worker; ends active listings matching filter
- `cancelBulkJob(jobId, userId)` -- cancels pending job (cannot cancel in-progress)
- `getSellerBulkJobs(sellerId, page)` -- paginated job history

### 4.2 Import Format

CSV columns (minimum):
```
title, description, priceCents, categorySlug, condition, brand, size, photos
```

JSON format:
```json
[{ "title": "...", "description": "...", "priceCents": 2500, "categorySlug": "womens-tops", ... }]
```

Twicely Export format: re-import from a previous export (round-trip).

### 4.3 Update Spec Operations

| Operation | Value semantics | Example |
|-----------|----------------|---------|
| `MULTIPLY_BPS` | Multiply price by value/10000 | `{value: 9000}` = 90% of current (10% off) |
| `ADD_CENTS` | Add value to price (can be negative) | `{value: -500}` = subtract $5.00 |
| `SET_CENTS` | Set absolute price | `{value: 3999}` = set to $39.99 |

**Safety checks:**
- `MULTIPLY_BPS`: result must be >= `seller.bulk.minPriceCents` (default 100 = $1.00)
- `ADD_CENTS`: result must be >= `seller.bulk.minPriceCents`
- No operation can set price to 0 or negative
- Max items per job: `seller.bulk.maxItemsPerJob` (default 5000)

---

## 5. ENHANCED VACATION MODE

### 5.1 Behavioral Variants

| Scenario | hideListings | extendHandling | pausePromotions | pauseCrosslister | Result |
|----------|-------------|---------------|----------------|-----------------|--------|
| **Hard away** | true | -- | true | true | Listings invisible; no orders; crosslister paused |
| **Soft away** | false | true | true | false | Listings visible with "+N days handling" banner; crosslister keeps syncing |
| **Away-but-open** | false | false | false | false | Normal operations; auto-reply on messages only |

These are UI presets. Sellers can customize any combination.

### 5.2 Vacation Activation Flow

1. Seller sets flags + optional schedule via `/hub/settings/vacation`
2. If `scheduledStart` is in the future, BullMQ cron activates at that time
3. On activation:
   - `sellerProfile.vacationMode = true`
   - If `hideListings`: `listing.status` unchanged but `listing.isHiddenByVacation = true` (need this column on listings table)
   - If `extendHandling`: all new orders get `handlingDueDays += handlingDaysAdd`
   - If `pausePromotions`: active promotions paused (set `promotion.isPaused = true`)
   - If `pauseCrosslister`: crosslister scheduler skips this seller
   - Storefront banner shows vacation message
4. On deactivation (manual or scheduled end):
   - `sellerProfile.vacationMode = false`
   - `isHiddenByVacation = false` on all listings
   - Promotions un-paused
   - Crosslister resumes
5. Reminder notification sent `reminderDaysBeforeEnd` days before scheduled end

### 5.3 Vacation Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `vacation-auto-activate` | `*/15 * * * *` | Activate scheduled vacations whose start time has passed |
| `vacation-auto-end` | `*/15 * * * *` | End vacations whose end time has passed (V3 already has this) |
| `vacation-reminder` | `0 9 * * *` | Send reminder N days before vacation ends |

---

## 6. ENHANCED BUYER BLOCK

### 6.1 Block Enforcement Points

| Flow | Check | Behavior |
|------|-------|----------|
| Cart add to cart | `isBuyerBlocked(sellerId, buyerId)` | Reject with "This seller is unavailable" |
| Make offer | `isBuyerBlockedForAction(sellerId, buyerId, 'OFFER')` | Reject with generic error |
| Send message | `isBuyerBlockedForAction(sellerId, buyerId, 'MESSAGE')` | Reject silently (message not delivered) |
| Purchase | `isBuyerBlockedForAction(sellerId, buyerId, 'PURCHASE')` | Reject at checkout |

### 6.2 Block Service Enhancements

Extend `packages/commerce/src/buyer-block.ts`:
- `blockBuyer(sellerId, buyerId, options)` -- upsert with reason code, action flags, optional expiry
- `unblockBuyer(sellerId, buyerId)` -- soft-delete (set inactive)
- `isBuyerBlockedForAction(sellerId, buyerId, actionType)` -- checks action-specific flag, logs attempt
- `getSellerBlockList(sellerId, page)` -- paginated list with attempt counts
- `getBlockAttempts(sellerId, page)` -- paginated attempt log
- `expireBlocks()` -- cron; deactivates blocks past `expiresAt`

### 6.3 Limits

- Max blocks per seller: `seller.block.maxPerSeller` (default 500)
- Self-block prevention: seller cannot block themselves
- Mutual block: if A blocks B, B can still see A's listings (no reciprocal enforcement unless B also blocks A)

---

## 7. SELLER APPEALS WORKFLOW

### 7.1 Appeal Flow

1. Seller receives enforcement action (coaching, warning, restriction, suspension, etc.)
2. Seller navigates to `/hub/enforcement/appeals` and sees actionable enforcement actions
3. Seller submits appeal: selects category, writes note, optionally uploads evidence (max 5 files, 10MB each)
4. System creates `sellerAppeal` with SLA deadline (`seller.appeal.slaHours` default 48h)
5. Appeal routed to moderation staff queue (`/corp/moderation/appeals`)
6. Staff reviews: APPROVE (overturns action), DENY (upholds), ESCALATE (routes to senior staff)
7. If approved: enforcement action status changed to `APPEAL_APPROVED`, restrictions lifted
8. If denied: seller notified with explanation
9. If escalated: new SLA starts, escalation staff reviews
10. SLA breach detection: cron flags appeals past deadline, auto-escalates

### 7.2 Appeal Eligibility

- One appeal per enforcement action
- Appeal must be submitted within `seller.appeal.windowDays` (default 30) of enforcement action creation
- Account bans require manual override to appeal (staff must enable)
- Auto-generated coaching notices are not appealable

### 7.3 Notifications

| Event | Recipient | Template Key |
|-------|-----------|-------------|
| Appeal submitted | Staff queue | `enforcement.appeal.submitted` |
| Appeal decision | Seller | `enforcement.appeal.decided` |
| Appeal escalated | Senior staff | `enforcement.appeal.escalated` |
| SLA breach | Moderation lead | `enforcement.appeal.slaBreach` |

---

## 8. PLATFORM SETTINGS KEYS

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `seller.bulk.maxItemsPerJob` | number | `5000` | Max listings per bulk operation |
| `seller.bulk.maxConcurrentJobs` | number | `2` | Max concurrent bulk jobs per seller |
| `seller.bulk.minPriceCents` | number | `100` | Min price after bulk update ($1.00) |
| `seller.bulk.exportTtlHours` | number | `48` | Export file download link TTL |
| `seller.bulk.importMaxFileSizeMb` | number | `50` | Max import file size |
| `seller.vacation.maxHandlingDaysAdd` | number | `14` | Max additional handling days |
| `seller.vacation.maxScheduleAheadDays` | number | `90` | Max days in advance to schedule |
| `seller.vacation.reminderDaysDefault` | number | `2` | Default reminder days before end |
| `seller.vacation.autoReplyMaxChars` | number | `500` | Auto-reply message character limit |
| `seller.block.maxPerSeller` | number | `500` | Max blocked buyers per seller |
| `seller.block.attemptLogRetentionDays` | number | `90` | How long to keep attempt logs |
| `seller.appeal.slaHours` | number | `48` | Staff review SLA in hours |
| `seller.appeal.windowDays` | number | `30` | Days after action to submit appeal |
| `seller.appeal.maxEvidenceFiles` | number | `5` | Max evidence uploads per appeal |
| `seller.appeal.maxEvidenceFileSizeMb` | number | `10` | Max evidence file size |

---

## 9. BULLMQ JOBS

| Job | Queue | Schedule/Trigger | Purpose |
|-----|-------|------------------|---------|
| `bulk-import` | `seller-tools` | On demand | Process CSV/JSON import |
| `bulk-export` | `seller-tools` | On demand | Generate export CSV |
| `bulk-price-update` | `seller-tools` | On demand | Apply price changes |
| `bulk-relist` | `seller-tools` | On demand | Relist ended listings |
| `bulk-end` | `seller-tools` | On demand | End active listings |
| `vacation-auto-activate` | `seller-tools` | `*/15 * * * *` | Activate scheduled vacations |
| `vacation-auto-end` | `seller-tools` | `*/15 * * * *` | End expired vacations |
| `vacation-reminder` | `seller-tools` | `0 9 * * *` | Send end-of-vacation reminders |
| `block-expiry` | `seller-tools` | `0 * * * *` | Deactivate expired blocks |
| `appeal-sla-check` | `seller-tools` | `*/30 * * * *` | Flag SLA breaches on pending appeals |

---

## 10. CASL PERMISSIONS

| Action | Subject | Roles |
|--------|---------|-------|
| `create` | `BulkListingJob` | Sellers (own listings only) |
| `read` | `BulkListingJob` | Own jobs, SUPPORT, ADMIN |
| `cancel` | `BulkListingJob` | Own pending jobs, ADMIN |
| `manage` | `VacationModeSchedule` | Own schedule only |
| `create` | `BuyerBlock` | Sellers (block buyers from own store) |
| `read` | `BuyerBlockAttempt` | Own block attempts, ADMIN |
| `create` | `SellerAppeal` | Sellers (own enforcement actions) |
| `manage` | `SellerAppeal` | MODERATION, ADMIN, SUPER_ADMIN |
| `read` | `SellerAppeal` | Own appeals, MODERATION, SUPPORT, ADMIN |

---

## 11. UI TOUCHPOINTS

### Seller Hub:
- `/hub/listings/bulk` -- Bulk operations dashboard (import, export, price update, relist, end)
- `/hub/settings/vacation` -- Vacation mode configuration with presets and schedule
- `/hub/settings/blocked-buyers` -- Block list management with attempt log
- `/hub/enforcement/appeals` -- View enforcement actions and submit appeals
- `/hub/enforcement/appeals/:id` -- Appeal detail + status tracking

### Admin:
- `/corp/moderation/appeals` -- Appeal review queue with SLA indicators
- `/corp/moderation/appeals/:id` -- Review/approve/deny/escalate appeal
- `/corp/analytics/bulk-jobs` -- Bulk job monitoring across all sellers
- `/corp/settings/seller-tools` -- Configure bulk limits, vacation settings, appeal SLA

---

## 12. DIFFERENTIATORS

| Feature | eBay | Poshmark | Twicely V4 |
|---------|------|----------|------------|
| Buyer block list | Yes (basic) | No | Granular (purchase/offer/message), expiring, logged |
| Block attempt log | No | No | Full attempt audit trail |
| Bulk import | CSV upload | No | CSV + JSON + round-trip export |
| Bulk price update | File exchange (slow) | No | Real-time with preview + safety checks |
| Bulk relist/end | Limited | Manual only | Filtered batch operations |
| Vacation scheduling | Basic toggle | No | Scheduled start/end, behavioral flags, crosslister pause |
| Vacation auto-reply | No | No | Custom message on all inbound messages |
| Vacation re-activation reminder | No | No | Configurable reminder before scheduled end |
| Appeals | Web form (slow) | No | Structured categories, evidence upload, SLA-tracked |
| Appeal escalation | Manual | No | Auto-escalation on SLA breach |
