# Canonical 35 -- Messaging Safety & Abuse Prevention

**Status:** DRAFT (V4)
**Domain:** hub-messaging, trust-safety
**Depends on:** Canonical 09 (Notifications), Canonical 26 (Risk/Fraud), `packages/db/src/schema/messaging.ts`, `@twicely/casl`, `@twicely/notifications/service`, `@twicely/jobs`, `@twicely/ai`
**Package:** `apps/web/src/lib/services/messaging-safety/` (new), extends `packages/db/src/schema/messaging.ts`

---

## 1. Purpose

Layer a comprehensive safety and abuse prevention system on top of V3's existing buyer-seller messaging. V3 already has `conversation` (buyer/seller, listing-scoped, unique triple dedup), `message` (immutable after send, attachments array, auto-generated flag), keyword management via `platform_settings` JSON blob, and a kill switch (`kill.messaging` in `featureFlag`). This canonical adds rate limiting, keyword DB migration, contact info detection, AI content moderation, blocked user messaging prevention, attachment safety, conversation archiving, automated progressive discipline, a moderation audit trail, off-platform transaction prevention, and seller response time tracking.

---

## 2. Core Principles

1. **Rate limits enforced server-side.** Client-side throttling is UX sugar only. The `sendMessage` service function must check rate limits before persisting.
2. **Keyword detection runs before persistence.** A blocked message never reaches the recipient's inbox. The original body is stored for the moderation audit trail but the message row has `isBlocked=true` and `body` replaced with `[Message blocked]` for the recipient view.
3. **Contact info is blocked, not flagged.** Email addresses, phone numbers, and social media handles are always `action=block`. Staff cannot downgrade contact info patterns to `flag` or `warn`.
4. **All moderation actions are audited.** Every flag, block, clear, hide, and restore produces a `messageModerationLog` row AND an `auditEvent` row.
5. **Rate limit settings read from `platform_settings`.** Never hardcoded.
6. **Banned keyword table is the source of truth.** The V3 JSON blob in `platform_settings` must be migrated to the `bannedKeyword` table.
7. **Progressive discipline is automated.** The platform tracks per-user safety violations and applies escalating consequences (warning, restriction, ban) without manual staff intervention.
8. **Blocked users cannot initiate conversations.** V3's buyer-block system (`buyerBlock` table in social.ts) must gate `createConversationAndSend`. If buyer is blocked by seller, messaging is denied for that pair.
9. **AI moderation is supplementary, not gating.** AI content scans run asynchronously after persistence. AI never blocks a message in the hot path -- it flags for human review.

---

## 3. Schema (Drizzle pgTable)

All new tables go in `packages/db/src/schema/messaging.ts` (extend existing file).

### 3.1 `bannedKeyword` table (new)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `keyword` | text, unique | Lowercase, trimmed |
| `category` | `bannedKeywordCategoryEnum` | `contact_info`, `profanity`, `spam`, `scam` |
| `action` | `bannedKeywordActionEnum` | `block`, `flag`, `warn` |
| `isRegex` | boolean, default false | If true, `keyword` is treated as a regex pattern |
| `isActive` | boolean, default true | Soft-disable without deleting |
| `createdByStaffId` | text, not null | Staff who created it |
| `createdAt` | timestamptz | |
| `updatedAt` | timestamptz | |

Indexes: `(category, isActive)`, unique on `keyword`.

Enums to add to `enums.ts`:
```ts
export const bannedKeywordCategoryEnum = pgEnum('banned_keyword_category', ['contact_info', 'profanity', 'spam', 'scam']);
export const bannedKeywordActionEnum = pgEnum('banned_keyword_action', ['block', 'flag', 'warn']);
export const moderationActionEnum = pgEnum('moderation_action', ['auto_blocked', 'auto_flagged', 'ai_flagged', 'manual_flagged', 'manual_hidden', 'manual_cleared', 'manual_restored']);
export const messageModerationStatusEnum = pgEnum('message_moderation_status', ['none', 'auto_flagged', 'ai_flagged', 'manual_review', 'cleared']);
export const safetyActionTypeEnum = pgEnum('safety_action_type', ['warning', 'rate_restrict', 'messaging_suspend', 'account_ban']);
```

### 3.2 `messageModerationLog` table (new)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `messageId` | text, FK -> message.id (cascade) | |
| `action` | `moderationActionEnum` | |
| `reason` | text, not null | Human-readable reason |
| `matchedKeywords` | text[], default `'{}'` | Keywords that triggered the action |
| `aiConfidence` | integer, nullable | AI model confidence score (0-100), null for non-AI actions |
| `staffId` | text, nullable | Null for auto/AI actions |
| `createdAt` | timestamptz | |

Indexes: `(messageId)`, `(action, createdAt)`.

### 3.3 `message` table extensions

Add columns to existing `message` table:

| Column | Type | Notes |
|---|---|---|
| `isBlocked` | boolean, default false | Message blocked from delivery |
| `blockReason` | text, nullable | Why the message was blocked |
| `moderationStatus` | `messageModerationStatusEnum` | `none`, `auto_flagged`, `ai_flagged`, `manual_review`, `cleared` |

### 3.4 `messageRateLimit` table (new)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `userId` | text, not null | |
| `windowStart` | timestamptz, not null | Start of the rate window (truncated to hour) |
| `messageCount` | integer, default 0 | |

Unique index: `(userId, windowStart)`.

### 3.5 `messageSafetyAction` table (new)

Audit trail of automated safety actions taken against users for messaging violations.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `userId` | text, not null, FK -> user.id (restrict) | The user who violated policy |
| `actionType` | `safetyActionTypeEnum` | `warning`, `rate_restrict`, `messaging_suspend`, `account_ban` |
| `violationCount` | integer, not null | Running count of violations for this user |
| `triggerMessageId` | text, nullable, FK -> message.id (set null) | The message that triggered this action |
| `reason` | text, not null | Human-readable description |
| `expiresAt` | timestamptz, nullable | When restriction/suspension expires (null = permanent) |
| `revokedAt` | timestamptz, nullable | Null unless staff manually revoked the action |
| `revokedByStaffId` | text, nullable | Staff who revoked |
| `createdAt` | timestamptz | |

Indexes: `(userId, createdAt)`, `(actionType, expiresAt)`.

### 3.6 `sellerResponseMetric` table (new)

Tracks seller response times for seller score integration.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK (cuid2) | |
| `sellerId` | text, not null, FK -> user.id (cascade) | |
| `conversationId` | text, not null, FK -> conversation.id (cascade) | |
| `firstBuyerMessageAt` | timestamptz, not null | When buyer sent the first message |
| `firstSellerResponseAt` | timestamptz, nullable | When seller first responded (null = no response yet) |
| `responseTimeMinutes` | integer, nullable | Calculated difference in minutes |
| `createdAt` | timestamptz | |

Indexes: `(sellerId, createdAt)`, unique on `(sellerId, conversationId)`.

---

## 4. Rate Limiting

### 4.1 Strategy

Sliding-window rate limiting via the `messageRateLimit` table. Window is 60 minutes, truncated to the hour boundary. The service reads limits from `getPlatformSetting()` on every call (cached via the standard 60-second platform_settings cache).

### 4.2 Response format for rate-limited requests

HTTP 429 with body:
```json
{
  "error": "RATE_LIMITED",
  "message": "Too many messages. Please wait before sending more.",
  "remaining": 0,
  "resetAt": "2026-04-09T15:00:00Z"
}
```

---

## 5. Keyword Detection & Contact Info Blocking

### 5.1 Detection pipeline

When `sendMessage()` is called:

1. **Contact info regex scan** (always `action=block`, cannot be overridden):
   - Email: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi`
   - US phone: `/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g`
   - International phone: `/\b\+\d{1,3}[-.\s]?\d{6,14}\b/g`
   - Social handles: `/@[a-zA-Z0-9_]{1,15}\b/g`
   - Platform names: `/\b(instagram|snapchat|whatsapp|telegram|facebook|venmo|cashapp|paypal)\b/gi`
   - Short-form: `/\b(ig|snap|wa|fb|dm me)\b/gi`
   - URL patterns: `/https?:\/\/[^\s]+/gi`, `/\b(www\.|bit\.ly|t\.co|tinyurl)\b/gi`

2. **Banned keyword DB scan**: Load active keywords from `bannedKeyword` table (cached 60s via Valkey). Match against lowercased message body. If `isRegex = true`, compile and test pattern.

3. **Action resolution**: If any match is `block`, the entire message is blocked. If any match is `flag` (and none are `block`), the message is flagged. `warn` only triggers a client-side warning (message still sends).

### 5.2 Keyword cache

Active keywords are cached in Valkey with key `messaging:bannedKeywords` and a 60-second TTL. Cache is busted on keyword create/update/delete via the keyword management API.

---

## 6. AI Content Moderation

### 6.1 Architecture

AI moderation is **asynchronous and supplementary**. It never blocks a message in the hot path. After a message is persisted:

1. A BullMQ job `messaging.ai-scan` is enqueued with the `messageId`.
2. The worker calls `@twicely/ai` with the message body for content classification.
3. Categories: `safe`, `suspicious`, `harassment`, `scam_attempt`, `explicit_content`.
4. If the AI confidence exceeds the threshold (platform setting `messaging.ai.flagThreshold`, default 80), the message is flagged:
   - Update `message.moderationStatus = 'ai_flagged'`, `message.isFlagged = true`.
   - Insert a `messageModerationLog` row with `action = 'ai_flagged'` and `aiConfidence`.
5. Flagged messages remain visible to the recipient but appear in the moderation queue for human review.

### 6.2 Kill switch

`messaging.ai.enabled` platform setting. When false, the `messaging.ai-scan` job is a no-op (dequeued but skipped). Default: `false` (opt-in at launch).

---

## 7. Blocked User Messaging Prevention

V3 has a `buyerBlock` table in `packages/db/src/schema/social.ts`. Extend the check to messaging:

1. In `createConversationAndSend()`: before creating a conversation, check if the buyer is blocked by the seller via the `buyerBlock` table.
2. If blocked, return `{ error: 'BLOCKED_BY_SELLER' }`. Do not create the conversation or message.
3. In `sendMessage()` (existing conversation): check if either party has blocked the other. If so, return `{ error: 'BLOCKED_USER' }`.
4. Staff bypass: HELPDESK_AGENT+ can send system messages to any conversation regardless of block status (for dispute resolution, etc.).

---

## 8. Attachment Safety

### 8.1 File type whitelist

Allowed MIME types (read from `messaging.attachments.allowedTypes` platform setting):
- `image/jpeg`, `image/png`, `image/gif`, `image/webp`

### 8.2 Size limits

Max file size: `messaging.attachments.maxSizeBytes` (default: 5MB / 5242880).

### 8.3 Image moderation

When an attachment is uploaded:
1. Validate MIME type against whitelist.
2. Validate file size.
3. Upload to R2/S3.
4. Enqueue `messaging.attachment-scan` BullMQ job for async image moderation (uses `@twicely/ai` image classification).
5. If the image is flagged, update the message's `moderationStatus` to `ai_flagged`.

### 8.4 Virus scanning

Deferred to V5. The architecture supports it via the async job pattern, but no virus scanning integration is included in V4.

---

## 9. Conversation Archiving & Retention

### 9.1 Auto-archive

Conversations with no messages in `messaging.archive.inactivityDays` days (default: 180) are auto-archived by a BullMQ cron job. Archived conversations:
- Set `conversation.status = 'ARCHIVED'`.
- Remain readable but cannot receive new messages unless reopened by staff.

### 9.2 Data retention

Message body content for archived conversations older than `messaging.retention.bodyPurgeDays` (default: 730 / 2 years) is replaced with `[Message content purged per retention policy]`. Metadata (sender, timestamps, moderation status) is retained for compliance.

---

## 10. Automated Progressive Discipline

### 10.1 Violation tracking

Each time a message is auto-blocked (keyword or contact info), the system increments the user's violation count. The count is stored as the max `violationCount` in `messageSafetyAction` for the user.

### 10.2 Escalation ladder

| Violation # | Action | Duration |
|---|---|---|
| 1 | `warning` | Instant notification to user |
| 2 | `rate_restrict` | Halve the user's rate limit for 24 hours |
| 3 | `messaging_suspend` | Suspend messaging for 72 hours |
| 5+ | `account_ban` | Flag for manual review by TRUST_SAFETY staff |

Thresholds are configurable via platform settings:
- `messaging.discipline.warningThreshold` (default: 1)
- `messaging.discipline.restrictThreshold` (default: 2)
- `messaging.discipline.suspendThreshold` (default: 3)
- `messaging.discipline.banReviewThreshold` (default: 5)
- `messaging.discipline.restrictDurationHours` (default: 24)
- `messaging.discipline.suspendDurationHours` (default: 72)

### 10.3 Staff override

Any `messageSafetyAction` can be revoked by TRUST_SAFETY or ADMIN staff, which sets `revokedAt` and `revokedByStaffId`.

---

## 11. Seller Response Time Tracking

### 11.1 Recording

When a buyer sends the first message in a conversation (detected by `conversation.lastMessageAt IS NULL` or sender is buyer and no prior seller message exists):
1. Insert a `sellerResponseMetric` row with `firstBuyerMessageAt = now()`.

When the seller sends their first reply:
1. Update `sellerResponseMetric.firstSellerResponseAt = now()`.
2. Calculate `responseTimeMinutes = EXTRACT(EPOCH FROM (firstSellerResponseAt - firstBuyerMessageAt)) / 60`.

### 11.2 Seller score integration

The seller score computation (`@twicely/scoring`) reads from `sellerResponseMetric` to calculate:
- **Average response time** (last 90 days).
- **Response rate** (% of conversations responded to within 24 hours).

These feed into the seller's performance band. Platform settings:
- `messaging.sellerResponse.targetMinutes` (default: 60) -- target response time for "excellent" rating.
- `messaging.sellerResponse.maxMinutes` (default: 1440 / 24 hours) -- beyond this counts as "no response".

---

## 12. RBAC

| Subject | Actions | Who |
|---|---|---|
| `Message` | `read` | BUYER, SELLER (own conversations only) |
| `Message` | `create` | BUYER, SELLER (own conversations only) |
| `Message` | `update` (moderate) | HELPDESK_AGENT+, TRUST_SAFETY, ADMIN |
| `ModerationAction` | `read` | HELPDESK_AGENT+, TRUST_SAFETY, ADMIN |
| `ModerationAction` | `create` | HELPDESK_AGENT+, TRUST_SAFETY, ADMIN |
| `ModerationAction` | `update` (bulk) | TRUST_SAFETY, ADMIN |
| `BannedKeyword` | `read` | HELPDESK_AGENT+, TRUST_SAFETY, ADMIN |
| `BannedKeyword` | `create`, `update`, `delete` | TRUST_SAFETY, ADMIN |
| `MessageSafetyAction` | `read` | HELPDESK_AGENT+, TRUST_SAFETY, ADMIN |
| `MessageSafetyAction` | `update` (revoke) | TRUST_SAFETY, ADMIN |

---

## 13. Platform Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `messaging.rateLimit.messagesPerHour` | integer | 20 | Global per-user hourly limit |
| `messaging.rateLimit.messagesPerConversationPerHour` | integer | 10 | Per-conversation hourly limit |
| `messaging.rateLimit.attachmentsPerDay` | integer | 5 | Per-user daily attachment limit |
| `messaging.rateLimit.enabled` | boolean | true | Master switch for rate limiting |
| `messaging.keywordFilter.enabled` | boolean | true | Master switch for keyword filtering |
| `messaging.contactInfoBlock.enabled` | boolean | true | Master switch for contact info blocking |
| `messaging.moderation.maxBulkBatchSize` | integer | 50 | Max messages per bulk moderation request |
| `messaging.ai.enabled` | boolean | false | Master switch for AI content moderation |
| `messaging.ai.flagThreshold` | integer | 80 | AI confidence threshold to auto-flag (0-100) |
| `messaging.attachments.allowedTypes` | string | `image/jpeg,image/png,image/gif,image/webp` | Comma-separated MIME whitelist |
| `messaging.attachments.maxSizeBytes` | integer | 5242880 | Max attachment file size (5MB) |
| `messaging.archive.inactivityDays` | integer | 180 | Days before auto-archive |
| `messaging.retention.bodyPurgeDays` | integer | 730 | Days before message body purge |
| `messaging.discipline.warningThreshold` | integer | 1 | Violations before warning |
| `messaging.discipline.restrictThreshold` | integer | 2 | Violations before rate restriction |
| `messaging.discipline.suspendThreshold` | integer | 3 | Violations before messaging suspension |
| `messaging.discipline.banReviewThreshold` | integer | 5 | Violations before account ban review |
| `messaging.discipline.restrictDurationHours` | integer | 24 | Rate restriction duration |
| `messaging.discipline.suspendDurationHours` | integer | 72 | Messaging suspension duration |
| `messaging.sellerResponse.targetMinutes` | integer | 60 | Target response time for excellent rating |
| `messaging.sellerResponse.maxMinutes` | integer | 1440 | Max response time before counted as no-response |

---

## 14. Out of Scope

- Real-time WebSocket chat (Centrifugo integration is a separate concern)
- Message editing or deletion by users (messages are immutable)
- Cross-conversation broadcasting
- Virus scanning of attachments (deferred to V5)
- Full NLP analysis beyond classification (sentiment analysis, intent extraction)
- Read receipts beyond existing `isRead` / `readAt` fields
