# V4 Install Phase 15 -- Messaging Safety & Abuse Prevention

**Status:** DRAFT (V4)
**Prereq:** V3 messaging system complete (conversation + message tables, messaging-actions.ts, keyword management UI at `/cfg/messaging/keywords`), BullMQ operational, Valkey connected
**Canonical:** `rules/canonicals/35_MESSAGING_SAFETY.md`
**V2 lineage:** Phase 27 (Messaging Enhancements)
**Estimated steps:** 9

---

## 0) What This Phase Installs

### Backend
- `bannedKeyword`, `messageModerationLog`, `messageRateLimit`, `messageSafetyAction`, `sellerResponseMetric` tables (Drizzle)
- `isBlocked`, `blockReason`, `moderationStatus` columns on existing `message` table
- 5 new enums in `enums.ts`
- Rate limiting service (per-user, per-conversation, reads from `platform_settings`)
- Keyword filter service with contact info regex detection + DB keyword scan + Valkey cache
- AI content moderation (async BullMQ job, integrates with `@twicely/ai`)
- Blocked user messaging prevention (integrates with `buyerBlock` table from social.ts)
- Automated progressive discipline (warning -> rate_restrict -> messaging_suspend -> account_ban)
- Seller response time tracking + stats for seller score integration
- Moderation queue API (list, bulk actions, single actions)
- Keyword management API rewritten to use `bannedKeyword` table (migrated from JSON blob)
- Conversation archiving + message body retention purge cron jobs

### Hub UI
- `/mod/messages` -- Moderation queue with keyword highlights, bulk actions
- `/mod/messages/safety-actions` -- Safety action audit log with revoke capability
- `/cfg/messaging/keywords` -- Upgrade existing page to use `bannedKeyword` table

### Marketplace UI
- Message composer: rate limit indicator, blocked content error messages
- Attachment MIME type + size validation

### Seed Data
- 12 default banned keywords (contact info, scam, spam)
- All `messaging.*` platform settings keys

---

## 1) Schema (Drizzle)

### Files

| File | Action |
|---|---|
| `packages/db/src/schema/enums.ts` | MODIFY (add 5 enums) |
| `packages/db/src/schema/messaging.ts` | MODIFY (add 5 tables, 3 columns to message) |
| `packages/db/src/schema/index.ts` | MODIFY (verify all new tables exported) |

### Step 1.1: Enums

Add to `packages/db/src/schema/enums.ts`:

```ts
export const bannedKeywordCategoryEnum = pgEnum('banned_keyword_category', ['contact_info', 'profanity', 'spam', 'scam']);
export const bannedKeywordActionEnum = pgEnum('banned_keyword_action', ['block', 'flag', 'warn']);
export const moderationActionEnum = pgEnum('moderation_action', [
  'auto_blocked', 'auto_flagged', 'ai_flagged',
  'manual_flagged', 'manual_hidden', 'manual_cleared', 'manual_restored',
]);
export const messageModerationStatusEnum = pgEnum('message_moderation_status', ['none', 'auto_flagged', 'ai_flagged', 'manual_review', 'cleared']);
export const safetyActionTypeEnum = pgEnum('safety_action_type', ['warning', 'rate_restrict', 'messaging_suspend', 'account_ban']);
```

### Step 1.2: Extend `message` table

Add three columns to the existing `message` table in `packages/db/src/schema/messaging.ts`:

```ts
isBlocked:          boolean('is_blocked').notNull().default(false),
blockReason:        text('block_reason'),
moderationStatus:   messageModerationStatusEnum('moderation_status').notNull().default('none'),
```

### Step 1.3: `bannedKeyword` table

```ts
export const bannedKeyword = pgTable('banned_keyword', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  keyword:          text('keyword').notNull().unique(),
  category:         bannedKeywordCategoryEnum('category').notNull(),
  action:           bannedKeywordActionEnum('action').notNull(),
  isRegex:          boolean('is_regex').notNull().default(false),
  isActive:         boolean('is_active').notNull().default(true),
  createdByStaffId: text('created_by_staff_id').notNull(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryActiveIdx: index('bk_category_active').on(table.category, table.isActive),
}));
```

### Step 1.4: `messageModerationLog` table

```ts
export const messageModerationLog = pgTable('message_moderation_log', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  messageId:        text('message_id').notNull().references(() => message.id, { onDelete: 'cascade' }),
  action:           moderationActionEnum('action').notNull(),
  reason:           text('reason').notNull(),
  matchedKeywords:  text('matched_keywords').array().notNull().default(sql`'{}'::text[]`),
  aiConfidence:     integer('ai_confidence'),
  staffId:          text('staff_id'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  messageIdx:       index('mml_message').on(table.messageId),
  actionDateIdx:    index('mml_action_date').on(table.action, table.createdAt),
}));
```

### Step 1.5: `messageRateLimit` table

```ts
export const messageRateLimit = pgTable('message_rate_limit', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  userId:           text('user_id').notNull(),
  windowStart:      timestamp('window_start', { withTimezone: true }).notNull(),
  messageCount:     integer('message_count').notNull().default(0),
}, (table) => ({
  userWindowIdx:    uniqueIndex('mrl_user_window').on(table.userId, table.windowStart),
}));
```

### Step 1.6: `messageSafetyAction` table

```ts
export const messageSafetyAction = pgTable('message_safety_action', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  userId:           text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  actionType:       safetyActionTypeEnum('action_type').notNull(),
  violationCount:   integer('violation_count').notNull(),
  triggerMessageId: text('trigger_message_id').references(() => message.id, { onDelete: 'set null' }),
  reason:           text('reason').notNull(),
  expiresAt:        timestamp('expires_at', { withTimezone: true }),
  revokedAt:        timestamp('revoked_at', { withTimezone: true }),
  revokedByStaffId: text('revoked_by_staff_id'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userDateIdx:      index('msa_user_date').on(table.userId, table.createdAt),
  typeExpiryIdx:    index('msa_type_expiry').on(table.actionType, table.expiresAt),
}));
```

### Step 1.7: `sellerResponseMetric` table

```ts
export const sellerResponseMetric = pgTable('seller_response_metric', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  conversationId:      text('conversation_id').notNull().references(() => conversation.id, { onDelete: 'cascade' }),
  firstBuyerMessageAt: timestamp('first_buyer_message_at', { withTimezone: true }).notNull(),
  firstSellerResponseAt: timestamp('first_seller_response_at', { withTimezone: true }),
  responseTimeMinutes: integer('response_time_minutes'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerDateIdx:       index('srm_seller_date').on(table.sellerId, table.createdAt),
  sellerConvIdx:       uniqueIndex('srm_seller_conv').on(table.sellerId, table.conversationId),
}));
```

### Step 1.8: Exports + migration

Update `packages/db/src/schema/index.ts` to export all 5 new tables.

```bash
cd packages/db && npx drizzle-kit generate --name messaging_safety_v4_15
```

---

## 2) Server Actions + Queries

### Step 2.1: Rate limiting service

File: `apps/web/src/lib/services/messaging-safety/rate-limit.ts`

```ts
export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean; remaining: number; resetAt: Date;
}>
// Reads messaging.rateLimit.messagesPerHour from getPlatformSetting (default 20)
// Reads messaging.rateLimit.enabled -- if false, always return allowed: true
// Window: 60 min truncated to hour boundary

export async function checkConversationRateLimit(
  userId: string, conversationId: string
): Promise<boolean>
// Reads messaging.rateLimit.messagesPerConversationPerHour (default 10)

export async function incrementRateLimit(userId: string): Promise<void>

export async function isUserRateRestricted(userId: string): Promise<boolean>
// Checks messageSafetyAction for active rate_restrict (not expired, not revoked)
```

### Step 2.2: Keyword filter service

File: `apps/web/src/lib/services/messaging-safety/keyword-filter.ts`

```ts
export const CONTACT_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b\+\d{1,3}[-.\s]?\d{6,14}\b/g,
  /@[a-zA-Z0-9_]{1,15}\b/g,
  /\b(instagram|snapchat|whatsapp|telegram|facebook|venmo|cashapp|paypal)\b/gi,
  /\b(ig|snap|wa|fb|dm me)\b/gi,
  /https?:\/\/[^\s]+/gi,
  /\b(www\.|bit\.ly|t\.co|tinyurl)\b/gi,
];

export type FilterResult = { action: 'allow' | 'flag' | 'block'; matchedKeywords: string[]; reason?: string };

export async function filterMessage(body: string): Promise<FilterResult>
// 1. Check messaging.contactInfoBlock.enabled -> run CONTACT_PATTERNS
// 2. Load bannedKeyword rows from Valkey cache (key: messaging:bannedKeywords, TTL 60s)
// 3. For isRegex keywords: compile + test. For plain: case-insensitive includes.
// 4. Resolve: block > flag > warn > allow

export async function bustKeywordCache(): Promise<void>
```

### Step 2.3: Moderation log service

File: `apps/web/src/lib/services/messaging-safety/moderation-log.ts`

```ts
export async function logModeration(input: {
  messageId: string; action: string; reason: string;
  matchedKeywords?: string[]; aiConfidence?: number; staffId?: string;
}): Promise<string>
// Creates messageModerationLog row + auditEvent

export async function getModerationQueue(opts: {
  status?: string[]; cursor?: string; limit?: number;
}): Promise<{ messages: ModerationQueueItem[]; nextCursor?: string }>

export async function moderateMessage(input: {
  messageId: string; action: 'flag' | 'clear' | 'hide' | 'restore';
  reason?: string; staffId: string;
}): Promise<void>

export async function bulkModerate(input: {
  messageIds: string[]; action: 'flag' | 'clear' | 'hide';
  reason?: string; staffId: string;
}): Promise<{ affected: number }>
// Enforces max batch size from messaging.moderation.maxBulkBatchSize (default 50)
```

### Step 2.4: Progressive discipline service

File: `apps/web/src/lib/services/messaging-safety/discipline.ts`

```ts
export async function recordViolation(
  userId: string, triggerMessageId: string, reason: string
): Promise<{ actionTaken: string; violationCount: number }>
// Reads thresholds from platform_settings:
//   messaging.discipline.warningThreshold (1)
//   messaging.discipline.restrictThreshold (2)
//   messaging.discipline.suspendThreshold (3)
//   messaging.discipline.banReviewThreshold (5)
// Creates messageSafetyAction row with appropriate actionType and expiresAt

export async function getActiveSafetyActions(userId: string): Promise<SafetyAction[]>

export async function revokeSafetyAction(actionId: string, staffId: string): Promise<void>

export async function isMessagingSuspended(userId: string): Promise<boolean>
// Checks for active messaging_suspend that is not expired and not revoked
```

### Step 2.5: Seller response time service

File: `apps/web/src/lib/services/messaging-safety/seller-response.ts`

```ts
export async function recordBuyerMessage(
  sellerId: string, conversationId: string
): Promise<void>
// Upsert sellerResponseMetric with firstBuyerMessageAt = now()
// ON CONFLICT (sellerId, conversationId) DO NOTHING

export async function recordSellerResponse(
  sellerId: string, conversationId: string
): Promise<void>
// Update sellerResponseMetric: firstSellerResponseAt = now()
// Calculate responseTimeMinutes

export async function getSellerResponseStats(
  sellerId: string, days?: number
): Promise<{ averageResponseMinutes: number; responseRate: number; totalConversations: number }>
// Reads messaging.sellerResponse.maxMinutes (1440) for no-response cutoff
```

### Step 2.6: Blocked user check

File: `apps/web/src/lib/services/messaging-safety/blocked-check.ts`

```ts
export async function canSendMessage(
  senderId: string, recipientId: string, senderRole?: string
): Promise<{ allowed: boolean; reason?: string }>
// 1. Check buyerBlock table (sender blocked by recipient)
// 2. Check isMessagingSuspended(senderId)
// 3. Staff bypass for HELPDESK_AGENT+ (check senderRole)
```

### Step 2.7: Integrate into sendMessage flow

Modify `apps/web/src/lib/actions/messaging-actions.ts`:

In `sendMessage()` / `createConversationAndSend()`:
1. `canSendMessage()` -- blocked user + suspension check
2. `checkRateLimit()` -- rate limit check (+ `isUserRateRestricted()` for halved limits)
3. `filterMessage()` -- keyword + contact info filter
4. If blocked: create message with `isBlocked=true`, log moderation, `recordViolation()`
5. If flagged: create message with `isFlagged=true`, `moderationStatus='auto_flagged'`, log moderation
6. `incrementRateLimit()`
7. Enqueue `messaging.ai-scan` BullMQ job (if `messaging.ai.enabled` platform setting is true)
8. `recordBuyerMessage()` or `recordSellerResponse()` -- response time tracking

### Step 2.8: Keyword management actions

File: `apps/web/src/lib/actions/messaging-keywords.ts`

```ts
'use server'
export async function createBannedKeyword(input): Promise<BannedKeyword>
export async function updateBannedKeyword(id, input): Promise<BannedKeyword>
export async function deleteBannedKeyword(id): Promise<void>  // soft delete
export async function listBannedKeywords(opts?): Promise<BannedKeyword[]>
// All actions: bustKeywordCache() after mutation, emitAuditEvent()
```

### Step 2.9: API routes

| Method | Path | CASL | Description |
|---|---|---|---|
| GET | `/api/platform/messaging/moderation-queue` | `read ModerationAction` | Paginated queue |
| POST | `/api/platform/messaging/moderate/bulk` | `update ModerationAction` | Bulk flag/clear/hide |
| POST | `/api/platform/messaging/moderate/[messageId]` | `create ModerationAction` | Single message moderate |
| GET | `/api/platform/messaging/safety-actions` | `read MessageSafetyAction` | Safety action audit log |
| POST | `/api/platform/messaging/safety-actions/[id]/revoke` | `update MessageSafetyAction` | Revoke safety action |
| GET | `/api/platform/messaging/keywords` | `read BannedKeyword` | List keywords (from table) |
| POST | `/api/platform/messaging/keywords` | `create BannedKeyword` | Add keyword |
| PATCH | `/api/platform/messaging/keywords/[id]` | `update BannedKeyword` | Update keyword |
| DELETE | `/api/platform/messaging/keywords/[id]` | `delete BannedKeyword` | Soft-delete keyword |

---

## 3) UI Pages

### Step 3.1: Moderation queue

Route: `apps/web/src/app/(hub)/mod/messages/page.tsx`

- Table: message excerpt (keyword highlights), sender, conversation link, matched keywords, moderationStatus, timestamp
- Filters: auto_flagged, ai_flagged, manual_review
- Bulk action toolbar: Flag, Clear, Hide (checkbox selection)
- Row expand: full message context, moderation history, conversation link

### Step 3.2: Safety actions log

Route: `apps/web/src/app/(hub)/mod/messages/safety-actions/page.tsx`

- Table: userId, actionType, violationCount, reason, expiresAt, revokedAt
- Filter by actionType
- Revoke button for TRUST_SAFETY+

### Step 3.3: Keyword management (upgrade)

Route: `apps/web/src/app/(hub)/cfg/messaging/keywords/page.tsx` (existing, modify)

- Switch data source from `platform_settings` JSON blob to `bannedKeyword` table
- Add: isRegex toggle, category filter, action filter
- Keep existing UI structure

### Step 3.4: Message composer updates

Modify existing message composer component:
- Rate limit remaining indicator ("X messages remaining this hour")
- Inline error for blocked messages ("This message cannot be sent: [reason]")
- Attachment MIME type + size validation (client-side + server-side)

---

## 4) BullMQ Jobs

### Step 4.1: AI content scan worker

File: `packages/jobs/src/workers/messaging-ai-scan.ts`

Queue: `messaging`, job name: `messaging.ai-scan`

```ts
export async function processAiScan(job: { data: { messageId: string } }): Promise<void>
// 1. Check messaging.ai.enabled -- if false, skip (no-op)
// 2. Load message body
// 3. Call @twicely/ai content classification
// 4. Categories: safe, suspicious, harassment, scam_attempt, explicit_content
// 5. If confidence > messaging.ai.flagThreshold (default 80):
//    - Update message.moderationStatus = 'ai_flagged', isFlagged = true
//    - Create messageModerationLog with action='ai_flagged', aiConfidence
```

### Step 4.2: Conversation archiving

File: `packages/jobs/src/workers/messaging-archive.ts`

Cron: daily at 04:00 UTC. Job name: `messaging.archive-inactive`

```ts
export async function archiveInactiveConversations(): Promise<{ archived: number }>
// SELECT conversation WHERE status='OPEN' AND lastMessageAt < NOW() - messaging.archive.inactivityDays
// UPDATE status='ARCHIVED' in batches
```

### Step 4.3: Message body retention purge

File: `packages/jobs/src/workers/messaging-retention-purge.ts`

Cron: weekly, Sunday 03:00 UTC. Job name: `messaging.retention-purge`

```ts
export async function purgeOldMessageBodies(): Promise<{ purged: number }>
// For ARCHIVED conversations older than messaging.retention.bodyPurgeDays (730):
//   UPDATE message SET body='[Message content purged per retention policy]'
```

### Step 4.4: Register jobs

File: `packages/jobs/src/cron-jobs.ts` -- register `messaging.archive-inactive` and `messaging.retention-purge` cron jobs with `tz: 'UTC'`.

---

## 5) Seed Data

### Step 5.1: Default banned keywords

File: `packages/db/src/seed/seed-banned-keywords.ts`

12 keywords with `createdByStaffId = 'system'`, using `ON CONFLICT DO NOTHING`:
- contact_info/block: "email me", "text me", "call me", "dm me", "message me on"
- scam/block: "western union", "wire transfer", "outside the platform", "off platform"
- scam/flag: "gift card"
- spam/flag: "check out my store", "follow me"

### Step 5.2: Platform settings

Seed all `messaging.*` keys from canonical section 13 (22 keys total).

### Step 5.3: Keyword migration script

File: `packages/db/src/seed/migrate-keywords-from-settings.ts`

Reads `comms.messaging.bannedKeywords` JSON blob from `platform_settings`, inserts each into `bannedKeyword` table, marks old setting as deprecated.

---

## 6) CASL

File: `packages/casl/src/subjects.ts` -- add: `ModerationAction`, `BannedKeyword`, `MessageSafetyAction`

File: `packages/casl/src/platform-abilities.ts` -- add rules per canonical 35 section 12:
- HELPDESK_AGENT+: read ModerationAction, create ModerationAction, read BannedKeyword, read MessageSafetyAction
- TRUST_SAFETY: update ModerationAction (bulk), full CRUD BannedKeyword, update MessageSafetyAction (revoke)
- ADMIN: inherits all

---

## 7) Tests

| File | Min Tests |
|---|---|
| `apps/web/src/lib/services/messaging-safety/__tests__/rate-limit.test.ts` | 8 |
| `apps/web/src/lib/services/messaging-safety/__tests__/keyword-filter.test.ts` | 12 |
| `apps/web/src/lib/services/messaging-safety/__tests__/moderation-log.test.ts` | 6 |
| `apps/web/src/lib/services/messaging-safety/__tests__/discipline.test.ts` | 8 |
| `apps/web/src/lib/services/messaging-safety/__tests__/seller-response.test.ts` | 5 |
| `apps/web/src/lib/services/messaging-safety/__tests__/blocked-check.test.ts` | 4 |
| `apps/web/src/lib/actions/__tests__/messaging-keywords.test.ts` | 8 |
| `packages/jobs/src/workers/__tests__/messaging-ai-scan.test.ts` | 4 |
| `packages/jobs/src/workers/__tests__/messaging-archive.test.ts` | 3 |
| `packages/casl/src/__tests__/messaging-safety-abilities.test.ts` | 4 |
| **Total** | **62** |

Key assertions:
- Rate limit enforced at exact threshold (20th message allowed, 21st rejected)
- Contact info patterns block email, US phone, international phone, social handles, URLs
- Blocked user cannot initiate conversation or send message
- Progressive discipline escalates through all 4 stages with correct thresholds
- Seller response time calculation is accurate in minutes
- Keyword Valkey cache is busted after CRUD
- AI scan is a no-op when `messaging.ai.enabled` is false
- Bulk moderation rejects batch over max size (50)
- Rate-restricted user gets halved limits for configured duration

---

## 8) Doctor Checks

```ts
async function checkMessagingSafety(): Promise<DoctorCheck[]> {
  // 1. Rate limiting blocks at threshold (increment to limit, verify rejection)
  // 2. Contact info regex blocks email (test@example.com -> action=block)
  // 3. Contact info regex blocks phone (555-123-4567 -> action=block)
  // 4. Banned keywords seeded (bannedKeyword count > 0)
  // 5. Moderation logging writable (insert + delete test row)
  // 6. Platform settings present for messaging.rateLimit.*
  // 7. BullMQ messaging queue responsive
}
```

---

## 9) Completion Criteria

- [ ] 5 new tables created, 3 columns added to `message`, 5 enums added
- [ ] Migration generated and applied
- [ ] Rate limiting enforced (20/hour per user, 10/hour per conversation)
- [ ] Contact info patterns block email, phone, social handles, URLs
- [ ] Banned keywords loaded from `bannedKeyword` table (not JSON blob)
- [ ] Keyword migration from `platform_settings` JSON blob executed
- [ ] Moderation queue API functional (list, bulk, single)
- [ ] AI content scan job enqueued when `messaging.ai.enabled = true`
- [ ] Progressive discipline escalates correctly through all 4 stages
- [ ] Seller response time tracked; stats available for seller score
- [ ] Blocked user check integrated into `sendMessage` and `createConversationAndSend`
- [ ] Conversation archiving cron registered
- [ ] Message body retention purge cron registered
- [ ] Safety action revocation functional for TRUST_SAFETY+
- [ ] All 22 `messaging.*` platform settings seeded
- [ ] 12 default banned keywords seeded
- [ ] CASL subjects (3) and abilities added
- [ ] Hub moderation queue page functional
- [ ] Hub safety actions page functional
- [ ] Keyword management page upgraded to use `bannedKeyword` table
- [ ] 62+ new tests passing
- [ ] `npx turbo typecheck` -- 0 errors
- [ ] `npx turbo test` -- baseline maintained or increased
