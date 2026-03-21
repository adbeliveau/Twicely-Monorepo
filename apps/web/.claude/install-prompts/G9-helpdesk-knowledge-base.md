# G9 — Helpdesk (/hd/*) + Knowledge Base (/kb/*, /h/*)

**Phase & Step:** [G9]
**Feature Name:** Helpdesk Agent Workspace, User Support Cases, Knowledge Base
**One-line Summary:** Build the complete built-in helpdesk system (case lifecycle, agent workspace, routing, SLA, macros, CSAT) and knowledge base (public help center, admin editor, article feedback) replacing any need for Zendesk.
**Date:** 2026-03-15

## Canonical Sources

| Document | Relevance |
|----------|-----------|
| `TWICELY_V3_HELPDESK_CANONICAL.md` | PRIMARY — all 30 sections, complete helpdesk + KB spec |
| `TWICELY_V3_SCHEMA_v2_1_0.md` | Section 13 (18 tables), Section 1.11 (9 enums) |
| `TWICELY_V3_PAGE_REGISTRY.md` | Sections 7, 8.7, 8.8 — routes |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | Section 5.4 — helpdesk role gates |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | Cross-references in sections 4, 15, 40 |
| `TWICELY_V3_DECISION_RATIONALE.md` | Decision #26 (built-in helpdesk over Zendesk) |
| `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` | Helpdesk settings keys (NOT YET SEEDED) |
| `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` | Hub sidebar entry (/hd, /kb) |
| `TWICELY_V3_TESTING_STANDARDS.md` | Test patterns |

---

## DECOMPOSITION

G9 is a large feature set (~80+ files). It MUST be split into 6 sub-steps. Each produces a working, testable increment.

| Sub-step | Name | Depends On | ~Time | ~Tests |
|----------|------|-----------|-------|--------|
| G9.1 | Schema Alignment + Seed Data + CASL | None | 45 min | 20 |
| G9.2 | Case Lifecycle Engine (actions + queries) | G9.1 | 60 min | 40 |
| G9.3 | User-Facing Support (submit + track cases) | G9.2 | 45 min | 25 |
| G9.4 | Agent Workspace (case queue + detail + compose) | G9.2 | 60 min | 30 |
| G9.5 | Knowledge Base (editor + public help center + search) | G9.1 | 60 min | 35 |
| G9.6 | Advanced Features (SLA cron, routing engine, macros, automation, CSAT, merge, reports) | G9.4 | 60 min | 35 |

**Total: ~185 new tests across ~80 files**

---

# G9.1 — Schema Alignment + Seed Data + CASL

## Prerequisites
- Phase A-G6 complete (all prior phases)
- Schema files `helpdesk.ts` and `kb.ts` ALREADY EXIST with tables (see "Existing State" below)
- Enums ALREADY EXIST in `enums.ts` (9 enums for helpdesk+KB)
- CASL subject `HelpdeskCase` ALREADY EXISTS in subjects.ts
- CASL abilities for `HelpdeskCase` ALREADY EXIST in buyer-abilities.ts and platform-abilities.ts

## Existing State (Schema-Only, No Business Logic)

### What EXISTS in `helpdesk.ts` (schema only — 219 lines):
All 13 helpdesk tables exist with correct schema matching Schema Doc v2.1.0 Section 13.1-13.13:
- `helpdeskCase`, `caseMessage`, `caseEvent`, `caseWatcher`, `caseCsat`
- `helpdeskTeam`, `helpdeskTeamMember`, `helpdeskRoutingRule`, `helpdeskMacro`
- `helpdeskSlaPolicy`, `helpdeskAutomationRule`, `helpdeskSavedView`, `helpdeskEmailConfig`

### What EXISTS in `kb.ts` (schema only — 103 lines):
All 5 KB tables exist matching Schema Doc Section 13.14-13.19:
- `kbCategory`, `kbArticle`, `kbArticleAttachment`, `kbArticleRelation`
- `kbCaseArticleLink`, `kbArticleFeedback`

### What EXISTS in `enums.ts`:
All 9 enums present (lines 138-150):
- `caseTypeEnum`: SUPPORT, ORDER, RETURN, DISPUTE, CHARGEBACK, BILLING, ACCOUNT, MODERATION, SYSTEM
- `caseStatusEnum`: NEW, OPEN, PENDING_USER, PENDING_INTERNAL, ON_HOLD, ESCALATED, RESOLVED, CLOSED
- `casePriorityEnum`: CRITICAL, URGENT, HIGH, NORMAL, LOW
- `caseChannelEnum`: WEB, EMAIL, SYSTEM, INTERNAL
- `caseMessageDirectionEnum`: INBOUND, OUTBOUND, INTERNAL, SYSTEM
- `caseMessageDeliveryStatusEnum`: PENDING, SENT, DELIVERED, FAILED, BOUNCED
- `kbArticleStatusEnum`: DRAFT, REVIEW, PUBLISHED, ARCHIVED
- `kbAudienceEnum`: ALL, BUYER, SELLER, AGENT_ONLY
- `kbBodyFormatEnum`: MARKDOWN, HTML, RICHTEXT

### What EXISTS in CASL:
- `HelpdeskCase` in SUBJECTS array (subjects.ts line 16)
- Buyer abilities: `can('read', 'HelpdeskCase', { userId })` + `can('create', 'HelpdeskCase')` (buyer-abilities.ts lines 76-77)
- Platform abilities: `can('manage', 'HelpdeskCase')` for staff (platform-abilities.ts line 20)
- System role defaults: HELPDESK_AGENT (read/create/update), HELPDESK_LEAD (+delete), HELPDESK_MANAGER (+delete)

### What EXISTS as Pages (skeleton placeholders only):
- `src/app/(hub)/hd/page.tsx` — placeholder with 3 stat cards + "launching soon" message
- `src/app/(hub)/kb/page.tsx` — placeholder with 3 stat cards + "launching soon" message
- `src/app/(marketplace)/h/page.tsx` — placeholder "Content coming soon"
- `src/app/(marketplace)/h/contact/page.tsx` — placeholder "email support@twicely.co"
- `src/app/(marketplace)/h/[category-slug]/page.tsx` — placeholder per category
- `src/app/(marketplace)/h/[category-slug]/[article-slug]/page.tsx` — exists (placeholder)

### What EXISTS in admin-nav.ts:
- Helpdesk entry: `{ key: 'helpdesk', href: '/hd', roles: ['HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER', 'ADMIN'] }`
- KB entry: `{ key: 'knowledge-base', href: '/kb', roles: ['HELPDESK_LEAD', 'HELPDESK_MANAGER', 'ADMIN'] }`

### What DOES NOT EXIST (to be built):
- **No actions** — no `src/lib/actions/*helpdesk*`, no `src/lib/actions/*case*`
- **No queries** — no `src/lib/queries/*helpdesk*`, no `src/lib/queries/*kb*`
- **No notification templates** for helpdesk
- **No platform settings** seeded for helpdesk
- **No seed data** for teams, SLA policies, routing rules, automation rules, KB categories
- **No CASL subjects** for KbArticle, KbCategory, HelpdeskTeam, HelpdeskMacro, HelpdeskSavedView
- **No validations** — no Zod schemas for case creation, message sending, macro CRUD, etc.
- **No background jobs** — no SLA check, no auto-close, no CSAT send
- **No Typesense index** for KB articles

### SPEC INCONSISTENCIES (Schema Doc v2.1.0 vs Helpdesk Canonical §25)

The Schema Doc (v2.1.0 Section 13) and Helpdesk Canonical (§25) have slightly different column definitions for several tables. The Schema Doc is the SINGLE SOURCE OF TRUTH for the database. The existing code in `helpdesk.ts` follows the Schema Doc. However, the Canonical §25 has richer schemas with additional columns. Here are the discrepancies:

**1. helpdeskCase — Schema Doc (in code) vs Canonical §25:**
- **In Schema Doc BUT NOT in Canonical §25:** `subcategory` column — present in code, absent from Canonical. KEEP IT (Schema Doc is authoritative).
- **In Canonical §25 BUT NOT in Schema Doc (or code):**
  - `emailThreadId` — for email threading
  - `emailSubjectLine` — for email subject
  - `lastActivityAt` — for tracking last activity
  - `source` — case source
  - `slaResolutionAt` — SLA resolution timestamp (Schema Doc has `slaResolutionDueAt` instead)
  - `slaFirstResponseAt` — (Schema Doc has `firstResponseAt` instead, same concept different name)
  - Additional indexes in Canonical that Schema Doc doesn't define
- **DECISION NEEDED:** The Canonical §25 has more complete indexes and some missing timestamp columns. The Schema Doc version is what's in code. Since adding columns is safe (migration), recommend adding `lastActivityAt` (required for queue sorting — Canonical §8.1) via migration. `emailThreadId` and `emailSubjectLine` are needed for email integration (§15) but can be deferred if email integration is not in G9 scope.

**2. caseMessage — Schema Doc (in code) vs Canonical §25:**
- **Schema Doc columns (in code):** senderType, senderId, senderName, direction, body, bodyHtml, attachments, deliveryStatus, emailMessageId, fromMergedCaseId
- **Canonical §25 columns NOT in code:** authorId/authorName/authorEmail/authorType (vs senderType/senderId/senderName), isInternal, emailInReplyTo, emailReferences, deliveredAt, deliveryError
- **Key difference:** Canonical uses `isInternal` boolean + richer delivery tracking. Schema Doc uses simpler model.
- **DECISION:** Schema Doc is authoritative. The existing code works. If needed, `isInternal` can be derived from `direction === 'INTERNAL'`. No migration needed.

**3. caseEvent — Schema Doc (in code) vs Canonical §25:**
- **Canonical has:** description, actorName, oldValue, newValue, metaJson
- **Schema Doc (code) has:** eventType, actorType, actorId, dataJson, fromMergedCaseId
- **DECISION:** Schema Doc is authoritative. Use `dataJson` to store oldValue/newValue/description as JSON fields.

**4. kbCategory — Schema Doc (in code) vs Canonical §25:**
- **Canonical §25 has:** `isPublished`, `audience`, `metaTitle`, `metaDescription`
- **Schema Doc (code) has:** `isActive` (instead of `isPublished`), NO audience, NO metaTitle/metaDescription
- **DECISION NEEDED:** The Canonical's `isPublished` + `audience` fields are needed for the public help center to properly filter categories. Schema Doc uses `isActive` which is functionally similar but lacks audience gating. Recommend adding `audience` to kbCategory via migration, and treating `isActive` as equivalent to `isPublished`.

**5. kbArticle — Schema Doc (in code) vs Canonical §25:**
- **Canonical §25 has:** `isPublished`, `canonicalUrl`, `lastEditedById`
- **Schema Doc (code) has:** NO `isPublished`, NO `canonicalUrl`, NO `lastEditedById`
- **DECISION:** `isPublished` can be derived from `status === 'PUBLISHED'`. `lastEditedById` and `canonicalUrl` from Canonical are nice-to-haves, not blockers. No migration needed for MVP.

**6. helpdeskRoutingRule — Schema Doc (in code) vs Canonical §25:**
- **Schema Doc (code):** `conditionsJson`, `actionsJson` (generic JSON blobs)
- **Canonical §25:** `conditionsJson`, `assignTeamId`, `assignAgentId`, `setPriority`, `addTags`, `setCategory`, `createdByStaffId` (structured columns)
- **DECISION NEEDED:** The Canonical version is much more structured and type-safe. The Schema Doc version stores everything in JSON blobs. Recommend adding the structured columns via migration for type safety and query efficiency in the routing engine.

**OWNER DECISION NEEDED on these 3 questions:**
1. Add `lastActivityAt` to helpdeskCase? (Recommended YES — needed for queue sorting)
2. Add `audience` to kbCategory? (Recommended YES — needed for audience gating)
3. Restructure helpdeskRoutingRule to add structured columns from Canonical? (Recommended YES — better type safety)

## Scope — G9.1 (Schema Alignment + Seed + CASL)

### Database Migration
Based on owner decisions above. At minimum:
- Add `lastActivityAt` timestamp column to `helpdesk_case` (default NOW)
- Drizzle migration file

### CASL Subjects to Add
Add to `src/lib/casl/subjects.ts` SUBJECTS array:
```
'KbArticle',
'KbCategory',
'HelpdeskTeam',
'HelpdeskMacro',
'HelpdeskSavedView',
'HelpdeskRoutingRule',
'HelpdeskSlaPolicy',
'HelpdeskAutomationRule',
'HelpdeskEmailConfig',
'CaseCsat',
```

### CASL Abilities to Add

**buyer-abilities.ts** (or seller-abilities.ts):
- `can('read', 'KbArticle')` — all authenticated users can read published articles
- `can('read', 'KbCategory')` — all authenticated users can read active categories
- `can('create', 'CaseCsat', { userId })` — case requester can submit CSAT

**platform-abilities.ts** (for staff):
- HELPDESK_AGENT: `can('manage', 'HelpdeskCase')`, `can('read', 'KbArticle')`, `can('read', 'HelpdeskTeam')`, `can('read', 'HelpdeskMacro')`, `can('read', 'HelpdeskSavedView')`, `can('manage', 'CaseCsat')`
- HELPDESK_LEAD: all AGENT abilities + `can('manage', 'HelpdeskMacro')`, `can('manage', 'KbArticle')`, `can('manage', 'KbCategory')`
- HELPDESK_MANAGER: all LEAD abilities + `can('manage', 'HelpdeskTeam')`, `can('manage', 'HelpdeskRoutingRule')`, `can('manage', 'HelpdeskSlaPolicy')`, `can('manage', 'HelpdeskAutomationRule')`, `can('manage', 'HelpdeskEmailConfig')`
- ADMIN: `can('manage', 'all')` (already exists)

**Reference:** Actors/Security Canonical Section 5.4:
- HELPDESK_AGENT can: read/create/update HelpdeskCase, read macros, read saved views
- HELPDESK_LEAD can: + manage macros, manage KB articles, view reports
- HELPDESK_MANAGER can: + manage teams, routing, SLA, automation, settings

### Seed Data

**1. Helpdesk Teams (5 teams per Canonical §10.3):**

| Name | isDefault | maxConcurrentCases |
|------|-----------|-------------------|
| General Support | true | 25 |
| Order Support | false | 25 |
| Trust & Safety | false | 15 |
| Moderation | false | 20 |
| Escalations | false | 10 |

**2. SLA Policies (5 policies per Canonical §12.1):**

| Priority | First Response (min) | Resolution (min) | businessHoursOnly | escalateOnBreach |
|----------|---------------------|-----------------|-------------------|-----------------|
| CRITICAL | 60 | 240 | false | true |
| URGENT | 120 | 480 | true | true |
| HIGH | 240 | 1440 | true | true |
| NORMAL | 480 | 2880 | true | false |
| LOW | 1440 | 4320 | true | false |

**3. Routing Rules (7 rules per Canonical §11.4):**

| # | Name | Condition (type =) | Team | Priority Override |
|---|------|--------------------|------|-------------------|
| 1 | Chargebacks to Trust | CHARGEBACK | Trust & Safety | CRITICAL |
| 2 | Disputes to Trust | DISPUTE | Trust & Safety | URGENT |
| 3 | Returns to Trust | RETURN | Trust & Safety | HIGH |
| 4 | Moderation to Mod | MODERATION | Moderation | — |
| 5 | Order Issues to Orders | ORDER | Order Support | — |
| 6 | Account to General | ACCOUNT | General Support | — |
| 7 | Billing to General | BILLING | General Support | — |

**4. Automation Rules (5 rules per Canonical §13.4):**

| # | Name | Trigger | Action |
|---|------|---------|--------|
| 1 | Auto-close stale pending | NO_RESPONSE (14d PENDING_USER) | Status -> CLOSED |
| 2 | SLA breach escalation (CRITICAL) | SLA_BREACHED (CRITICAL) | ESCALATED + Escalations team |
| 3 | SLA breach escalation (URGENT) | SLA_BREACHED (URGENT) | ESCALATED + Escalations team |
| 4 | Reopen notification | CASE_REOPENED | Notify agent + tag "reopened" |
| 5 | Welcome message received | MESSAGE_RECEIVED (PENDING_USER) | Status -> OPEN |

**5. KB Categories (8 categories per Canonical §20.2):**

| Category | Slug | Icon | Audience |
|----------|------|------|----------|
| Orders & Shipping | orders-shipping | Package | ALL |
| Returns & Refunds | returns-refunds | RefreshCw | ALL |
| Payments & Billing | payments-billing | CreditCard | ALL |
| Buyer Protection | buyer-protection | Shield | ALL |
| Selling on Twicely | selling | Store | SELLER |
| Crosslister | crosslister | Link2 | SELLER |
| Account & Settings | account | User | ALL |
| Policies | policies | FileText | ALL |

**6. Platform Settings (14 settings per Canonical §24.1):**
Seed into `v32-platform-settings-extended.ts`:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `helpdesk.businessHours.start` | string | "09:00" | Business hours start |
| `helpdesk.businessHours.end` | string | "18:00" | Business hours end |
| `helpdesk.businessHours.timezone` | string | "America/New_York" | Timezone |
| `helpdesk.businessHours.workDays` | array | [1,2,3,4,5] | Work days (Mon-Fri) |
| `helpdesk.autoClose.pendingUserDays` | number | 14 | Days to auto-close PENDING_USER |
| `helpdesk.autoClose.resolvedDays` | number | 7 | Days to auto-close RESOLVED |
| `helpdesk.reopen.windowDays` | number | 7 | Days after resolve user can reopen |
| `helpdesk.csat.enabled` | boolean | true | CSAT collection enabled |
| `helpdesk.csat.surveyDelayMinutes` | number | 30 | Delay before CSAT email |
| `helpdesk.roundRobin.enabled` | boolean | true | Round-robin assignment |
| `helpdesk.maxAttachments` | number | 5 | Max attachments per message |
| `helpdesk.maxAttachmentSizeMb` | number | 10 | Max file size per attachment |
| `helpdesk.retentionDays` | number | 365 | Resolved case retention |
| `helpdesk.email.signatureStripEnabled` | boolean | true | Strip email signatures |

**7. Sequence Counter Seed:**
Seed a `sequenceCounter` row: `{ name: 'helpdesk_case', prefix: 'HD-', currentValue: 0, paddedWidth: 6 }`

**8. System Case Templates (6 templates per Canonical §30.2):**
Seed as platform settings under `helpdesk.templates.*` category:
- `helpdesk.templates.chargeback`
- `helpdesk.templates.dispute`
- `helpdesk.templates.return`
- `helpdesk.templates.moderation.message`
- `helpdesk.templates.moderation.listing`
- `helpdesk.templates.fraud`

### Validations (Zod Schemas)

Create `src/lib/validations/helpdesk.ts`:

```typescript
// Case creation (user-initiated via /h/contact)
const createCaseSchema = z.object({
  type: z.enum(['SUPPORT', 'ORDER', 'RETURN', 'BILLING', 'ACCOUNT']),
  subject: z.string().min(10).max(200),
  description: z.string().min(50).max(5000),
  orderId: z.string().optional(),
  listingId: z.string().optional(),
  attachments: z.array(z.object({
    url: z.string().url(),
    filename: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
  })).max(5).optional(),
}).strict();

// Case message (user reply)
const createCaseMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  attachments: z.array(z.object({
    url: z.string().url(),
    filename: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
  })).max(5).optional(),
}).strict();

// Agent reply (staff)
const agentReplySchema = z.object({
  caseId: z.string(),
  body: z.string().min(1).max(10000),
  bodyHtml: z.string().optional(),
  isInternal: z.boolean().default(false),
  attachments: z.array(z.object({
    url: z.string().url(),
    filename: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
  })).max(5).optional(),
}).strict();

// Case status update
const updateCaseStatusSchema = z.object({
  caseId: z.string(),
  status: z.enum(['OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED', 'RESOLVED']),
}).strict();

// Case assignment
const assignCaseSchema = z.object({
  caseId: z.string(),
  assignedAgentId: z.string().nullable(),
  assignedTeamId: z.string().nullable(),
}).strict();

// Case priority update
const updateCasePrioritySchema = z.object({
  caseId: z.string(),
  priority: z.enum(['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW']),
}).strict();

// CSAT submission
const submitCsatSchema = z.object({
  caseId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
}).strict();

// Macro CRUD
const createMacroSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  bodyTemplate: z.string().min(1).max(10000),
  actionsJson: z.array(z.object({
    type: z.string(),
    value: z.unknown(),
  })).optional(),
  isShared: z.boolean().default(true),
}).strict();

// Saved view
const createSavedViewSchema = z.object({
  name: z.string().min(1).max(100),
  filtersJson: z.record(z.unknown()),
  sortJson: z.record(z.unknown()).optional(),
  isDefault: z.boolean().default(false),
}).strict();

// KB article
const createKbArticleSchema = z.object({
  categoryId: z.string(),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/),
  title: z.string().min(3).max(200),
  excerpt: z.string().max(300).optional(),
  body: z.string().min(10),
  bodyFormat: z.enum(['MARKDOWN', 'HTML', 'RICHTEXT']).default('MARKDOWN'),
  audience: z.enum(['ALL', 'BUYER', 'SELLER', 'AGENT_ONLY']).default('ALL'),
  tags: z.array(z.string()).optional(),
  searchKeywords: z.array(z.string()).optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(300).optional(),
  isFeatured: z.boolean().default(false),
  isPinned: z.boolean().default(false),
}).strict();

// KB category
const createKbCategorySchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  parentId: z.string().nullable().optional(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

// KB article feedback
const submitArticleFeedbackSchema = z.object({
  articleId: z.string(),
  helpful: z.boolean(),
  comment: z.string().max(500).optional(),
}).strict();
```

### Notification Templates

Create `src/lib/notifications/templates-helpdesk.ts`:

| Template Key | Channel | Description |
|-------------|---------|-------------|
| `helpdesk.case.created` | EMAIL, IN_APP | Case confirmation to requester |
| `helpdesk.case.auto_reply` | EMAIL | Auto-reply with case # + suggested articles |
| `helpdesk.case.agent_reply` | EMAIL, IN_APP | Agent sent a reply |
| `helpdesk.case.resolved` | EMAIL, IN_APP | Case marked resolved |
| `helpdesk.case.closed` | EMAIL | Case auto-closed |
| `helpdesk.case.reopened` | EMAIL, IN_APP | Case reopened by user |
| `helpdesk.csat.request` | EMAIL | CSAT survey request |
| `helpdesk.agent.assigned` | IN_APP | Agent assigned to case |
| `helpdesk.agent.sla_warning` | IN_APP | SLA about to breach |
| `helpdesk.agent.sla_breach` | IN_APP | SLA breached |
| `helpdesk.agent.mention` | IN_APP | Agent mentioned in internal note |

---

# G9.2 — Case Lifecycle Engine (Actions + Queries)

## Prerequisites
- G9.1 complete (seed data, CASL, validations)

## Scope

### Server Actions — `src/lib/actions/helpdesk-cases.ts`

**`createCase(formData)`** — User-initiated case creation
1. Authorize: `can('create', 'HelpdeskCase')`
2. Validate with `createCaseSchema.strict()`
3. Generate case number via `sequenceCounter` (atomic increment: `UPDATE ... SET current_value = current_value + 1 RETURNING current_value`)
4. Format: `HD-` + zero-padded to 6 digits (e.g., `HD-000001`)
5. Set channel = `WEB`, status = `NEW`, priority = `NORMAL`, requesterId = session.userId
6. Set requesterType = 'buyer' or 'seller' (based on user's isSeller flag)
7. If orderId provided, look up order and set sellerId from order
8. Execute routing rules (§11) to assign team/agent/priority/tags
9. Calculate SLA deadlines from matched SLA policy
10. Insert `helpdeskCase`
11. Insert initial `caseMessage` with direction = INBOUND (the description)
12. Insert `caseEvent` with eventType = 'created'
13. Send `helpdesk.case.created` notification to requester
14. If auto-reply enabled, send `helpdesk.case.auto_reply` email
15. Revalidate `/my/support`
16. Return `{ success: true, caseNumber }`

**`addUserReply(caseId, formData)`** — User replies to their case
1. Authorize: `can('read', 'HelpdeskCase', { userId: session.userId })`
2. Verify case.requesterId === session.userId
3. Validate with `createCaseMessageSchema.strict()`
4. Insert `caseMessage` with direction = INBOUND, senderType = 'user', senderId = session.userId
5. If case status was PENDING_USER -> set to OPEN
6. Update case.updatedAt (and lastActivityAt if column exists)
7. Insert `caseEvent` with eventType = 'user_replied'
8. Revalidate `/my/support/[caseId]`

**`addAgentReply(formData)`** — Staff replies to case
1. Staff authorize via `staffAuthorize()`
2. Validate with `agentReplySchema.strict()`
3. Determine direction: if formData.isInternal -> INTERNAL, else OUTBOUND
4. Insert `caseMessage` with direction, senderType = 'agent', senderId = staffUser.id, senderName = staffUser.name
5. If direction === OUTBOUND and case.firstResponseAt is null -> set firstResponseAt = now
6. If direction === OUTBOUND -> send `helpdesk.case.agent_reply` notification to requester
7. Update case.updatedAt (and lastActivityAt)
8. Insert `caseEvent` with eventType = 'agent_reply' or 'internal_note'
9. Revalidate `/hd/cases/[caseId]`

**`updateCaseStatus(formData)`** — Agent changes case status
1. Staff authorize
2. Validate with `updateCaseStatusSchema.strict()`
3. Verify valid transition (no arbitrary jumps — enforce lifecycle from §3.4)
4. If new status = RESOLVED -> set resolvedAt = now, send `helpdesk.case.resolved` notification
5. If new status = CLOSED -> set closedAt = now
6. Insert `caseEvent` with eventType = 'status_changed', old/new values in dataJson
7. Update case status + updatedAt
8. Revalidate

**`assignCase(formData)`** — Agent/manager assigns case
1. Staff authorize
2. Validate with `assignCaseSchema.strict()`
3. If assignedAgentId: verify agent exists as staffUser with helpdesk role
4. If assignedTeamId: verify team exists
5. Update case assignment fields
6. Update helpdeskTeamMember.activeCaseCount (decrement old, increment new)
7. Insert `caseEvent` with eventType = 'assigned'
8. Send `helpdesk.agent.assigned` notification to new agent
9. Revalidate

**`updateCasePriority(formData)`** — Agent changes priority
1. Staff authorize
2. Validate with `updateCasePrioritySchema.strict()`
3. Recalculate SLA deadlines based on new priority's SLA policy
4. Insert `caseEvent` with eventType = 'priority_changed'
5. Update case priority + SLA fields + updatedAt

**`updateCaseTags(caseId, tags: string[])`** — Agent adds/removes tags
1. Staff authorize
2. Update tags array on case
3. Insert `caseEvent` with eventType = 'tags_changed'

**`reopenCase(caseId)`** — User reopens a resolved case
1. Authorize: case.requesterId === session.userId
2. Verify case.status === 'RESOLVED'
3. Verify within reopen window (platform setting `helpdesk.reopen.windowDays`)
4. Set status = OPEN, reopenedAt = now
5. Insert `caseEvent` with eventType = 'reopened'
6. Send `helpdesk.case.reopened` notification
7. Resume SLA clock

### Server Actions — `src/lib/actions/helpdesk-csat.ts`

**`submitCsat(formData)`**
1. Authorize: case.requesterId === session.userId
2. Validate with `submitCsatSchema.strict()`
3. Verify case.status === 'RESOLVED' (not yet closed)
4. Verify no existing CSAT for this case
5. Insert `caseCsat` record
6. Insert `caseEvent` with eventType = 'csat_submitted'

### Queries — `src/lib/queries/helpdesk-cases.ts`

**`getCasesByRequester(userId, filters?)`** — User's cases for /my/support
- Filter: requesterId = userId
- Optional status filter
- Paginated, sorted by updatedAt desc
- Returns: caseNumber, subject, status, priority, updatedAt

**`getCaseDetail(caseId, userId)`** — Single case for /my/support/[caseId]
- Verify requesterId = userId
- Include messages WHERE direction !== 'INTERNAL' (hide internal notes from users)
- Include events (filtered to user-visible events only)
- Return case + messages + events

**`getAgentCaseQueue(staffUserId, filters?)`** — Agent's case queue for /hd
- Filterable by: status[], priority[], type[], channel[], assignedAgentId, assignedTeamId, tags[], SLA status
- Sortable by: SLA due, createdAt, updatedAt, priority
- Paginated
- Returns: caseNumber, subject, requesterName, type, priority, status, assignedAgentName, teamName, slaCountdown, updatedAt

**`getAgentCaseDetail(caseId)`** — Full case detail for /hd/cases/[id]
- All messages (including internal notes)
- All events
- Commerce context IDs (orderId, listingId, etc.)
- SLA status (remaining time, breached?)
- Tags
- Watchers

**`getCaseContextData(caseId)`** — Context panel data
- If orderId: load order with items, shipment, buyer/seller info
- If listingId: load listing with images, seller
- If sellerId: load seller profile with performance metrics
- If returnRequestId: load return with status
- If disputeCaseId: load dispute with status
- If conversationId: load conversation metadata
- Related cases (same requester, same orderId, same sellerId)

### Routing Engine — `src/lib/helpdesk/routing.ts`

**`evaluateRoutingRules(caseData)`**
1. Load all active routing rules, sorted by sortOrder ASC
2. For each rule, evaluate conditionsJson against case data
3. First matching rule wins
4. Apply actions: assignTeamId, setPriority, addTags, setCategory
5. If rule assigns a team but not an agent -> round-robin within team:
   a. Get available team members (isAvailable = true)
   b. Filter out agents at maxConcurrentCases
   c. Assign to agent with fewest activeCaseCount
6. If no rule matches -> assign to default team (isDefault = true)
7. Return: { teamId, agentId, priority, tags, category }

### SLA Calculator — `src/lib/helpdesk/sla.ts`

**`calculateSlaDue(priority, createdAt, businessHoursConfig)`**
1. Load SLA policy for priority
2. If businessHoursOnly: calculate due date accounting for business hours only
3. If not businessHoursOnly: calculate due date in calendar minutes
4. Return: { firstResponseDue, resolutionDue }

### Case Number Generator — `src/lib/helpdesk/case-number.ts`

**`generateCaseNumber()`**
1. Atomic SQL: `UPDATE sequence_counter SET current_value = current_value + 1 WHERE name = 'helpdesk_case' RETURNING current_value, prefix, padded_width`
2. Format: `${prefix}${String(currentValue).padStart(paddedWidth, '0')}`
3. Return: `"HD-000001"`

---

# G9.3 — User-Facing Support (Submit + Track Cases)

## Prerequisites
- G9.2 complete

## Scope

### Pages

**`/h/contact` — Contact Support form** (replace existing placeholder)
Route: `src/app/(marketplace)/h/contact/page.tsx`
Layout: marketplace
Gate: AUTH (must be logged in)

- Form fields per Canonical §4.1:
  - Type dropdown: General, Order Issue, Return, Billing, Account
  - Related Order (optional, searchable dropdown of user's recent orders)
  - Subject (10-200 chars)
  - Description (50-5000 chars, rich text via textarea)
  - Attachments (up to 5 files, max 10MB each, image/PDF only)
- Pre-fill from query params: `?type=ORDER&orderId=xxx`
- On submit: call `createCase()` server action
- On success: redirect to `/my/support/{caseNumber}`

**`/my/support` — My Support Cases** (create new page)
Route: `src/app/(marketplace)/my/support/page.tsx`
Layout: dashboard
Gate: AUTH

- Table: Case #, Subject, Status (user-friendly label), Updated
- Status labels per Canonical §3.4:
  - NEW -> "Received"
  - OPEN -> "In Progress"
  - PENDING_USER -> "Awaiting Your Reply"
  - PENDING_INTERNAL -> "In Progress"
  - ON_HOLD -> "On Hold"
  - ESCALATED -> "Under Review"
  - RESOLVED -> "Resolved"
  - CLOSED -> "Closed"
- Sort by last activity desc
- Filter by status tabs: All / Open / Resolved / Closed
- Empty state: "No support cases yet. Need help? [Contact Support]"

**`/my/support/[caseId]` — Case Detail (User)** (create new page)
Route: `src/app/(marketplace)/my/support/[caseId]/page.tsx`
Layout: dashboard
Gate: AUTH + case.requesterId === session.userId

- Case header: case number, subject, status badge (user-friendly)
- Timeline of messages (direction !== INTERNAL only) + events
- Reply form: text + attachments
- If status === RESOLVED: show CSAT inline prompt ("How was your experience?")
- If status === RESOLVED and within reopen window: "Reopen Case" button

### "Get Help" Entry Points (Canonical §16.3)

Add "Get Help" buttons to existing pages (modify, not create):
- `/my/buying/orders/[id]` — add "Get Help" button, links to `/h/contact?type=ORDER&orderId={id}`
- `/my/selling/orders/[id]` — add "Get Help" button (seller side)
- Listing detail `/i/[slug]` — add "Report" button, links to `/h/contact?type=MODERATION&listingId={id}`

---

# G9.4 — Agent Workspace (Case Queue + Detail + Compose)

## Prerequisites
- G9.2 complete

## Scope

### Helpdesk Layout

The helpdesk is a SEPARATE full-screen app (Canonical §6.1). It uses the `helpdesk` layout per Page Registry.

Create `src/app/(hub)/hd/layout.tsx`:
- Full-screen three-column layout
- Left sidebar: Dashboard, My Cases, All Cases, Views, Macros, Teams, Routing, SLA, Automation, Reports, Settings (gated by role per Canonical §6.1)
- Sidebar items gated by role:
  - HELPDESK_AGENT: Dashboard, My Cases, All Cases, Views
  - HELPDESK_LEAD: + Macros, Reports
  - HELPDESK_MANAGER: + Teams, Routing, SLA, Automation, Settings

### Pages

**`/hd` — Case Queue (replace existing placeholder)**
Route: `src/app/(hub)/hd/page.tsx`
Gate: STAFF(HELPDESK_AGENT+)

- Default view tabs per Canonical §8.1:
  - My Cases (assignedAgentId = me, active statuses)
  - Unassigned (no agent, status = NEW)
  - All Open (all active statuses)
  - SLA Breached (overdue)
  - Resolved
- Table columns per Canonical §8.2: Case #, Subject, Requester, Type, Priority, Status, Agent, Team, SLA, Updated
- Filters per Canonical §8.3: Status, Priority, Type, Channel, Agent, Team, Tags, SLA Status, Date range
- Filter state in URL query params
- Bulk actions per Canonical §8.4: Assign agent, Assign team, Change priority, Add tags, Resolve (max 50)

**`/hd/cases/[id]` — Case Detail (Agent Workspace)**
Route: `src/app/(hub)/hd/cases/[id]/page.tsx`
Gate: STAFF(HELPDESK_AGENT+)
Layout: Three-column per Canonical §7

Left column (280px): Case properties panel
- Case number
- Status dropdown (inline-editable)
- Priority dropdown (color-coded)
- Type badge (read-only)
- Channel badge (read-only)
- Assigned Agent dropdown
- Assigned Team dropdown
- Tags (add/remove)
- SLA countdown (color-coded: green >50%, yellow 25-50%, red <25%)
- Created/Updated timestamps

Center column: Conversation thread
- Messages + events interleaved chronologically
- Different styling per Canonical §7.2:
  - Inbound (user): left-aligned, light background
  - Outbound (agent): right-aligned, brand background
  - Internal note: yellow background, lock icon
  - System event: gray inline text
- Compose area with tabs: Reply | Internal Note
- Macro picker (searchable dropdown)
- KB article insertion button
- Attachment upload
- Cmd+Enter to send

Right column (360px, collapsible): Context panel
- Requester card (always shown): name, email, member since, orders/cases/reviews counts
- Commerce context cards (auto-loaded based on linked IDs) per Canonical §7.3
- Related cases
- Suggested KB articles

**`/hd/views` — Saved Views**
Route: `src/app/(hub)/hd/views/page.tsx`
Gate: STAFF(HELPDESK_AGENT+)

- List of personal + shared saved views
- Create/edit/delete views
- Each view = named filter preset
- Set default view

**`/hd/macros` — Macro Library**
Route: `src/app/(hub)/hd/macros/page.tsx`
Gate: STAFF(HELPDESK_LEAD+)

- Table: Title, Category, Shared/Personal, Usage Count, Created By, Actions
- Create/edit/delete macros
- Macro form: title, body template (with variable placeholders), category, optional actions (setStatus, setPriority, addTags), isShared
- Template variables per Canonical §9.3: `{{buyer_name}}`, `{{case_number}}`, `{{order_number}}`, `{{agent_name}}`, `{{listing_title}}`, `{{seller_name}}`, `{{return_status}}`

**`/hd/teams` — Team Management**
Route: `src/app/(hub)/hd/teams/page.tsx`
Gate: STAFF(HELPDESK_MANAGER)

- List of teams with member count, isDefault flag
- Create/edit teams
- Manage team members (add/remove staff, set availability, case limits)
- One team must be isDefault = true

**`/hd/routing` — Routing Rules**
Route: `src/app/(hub)/hd/routing/page.tsx`
Gate: STAFF(HELPDESK_MANAGER)

- Ordered list of routing rules (drag-to-reorder)
- Each rule: name, conditions summary, action summary, isActive toggle
- Create/edit rules with condition builder
- Conditions: type, channel, priority, subject contains, tags, requesterType
- Actions: assign team, assign agent, set priority, add tags, set category

**`/hd/sla` — SLA Policies**
Route: `src/app/(hub)/hd/sla/page.tsx`
Gate: STAFF(HELPDESK_MANAGER)

- Table: Priority, First Response Target, Resolution Target, Business Hours Only, Escalate on Breach, Active
- Edit policies (one per priority)
- Business hours config (start, end, timezone, work days)

**`/hd/automation` — Automation Rules**
Route: `src/app/(hub)/hd/automation/page.tsx`
Gate: STAFF(HELPDESK_MANAGER)

- Ordered list of automation rules
- Each rule: name, trigger event, conditions summary, actions summary, isActive toggle
- Create/edit rules with trigger/condition/action builder
- Triggers per Canonical §13.2
- Actions per Canonical §13.3

**`/hd/reports` — Reports Dashboard**
Route: `src/app/(hub)/hd/reports/page.tsx`
Gate: STAFF(HELPDESK_LEAD+)

- Dashboard metrics per Canonical §23.1: open cases, avg response time, avg resolution time, SLA compliance %, CSAT score
- Charts: cases by type, cases by channel, agent workload
- Date range selector
- Detailed report links (volume, SLA, agent performance, resolution, CSAT, tags, KB effectiveness)

**`/hd/settings` — Helpdesk Settings**
Route: `src/app/(hub)/hd/settings/page.tsx`
Gate: STAFF(HELPDESK_MANAGER) + ADMIN

- Business hours config
- Auto-close settings
- Reopen window
- CSAT settings
- Round-robin toggle
- Attachment limits
- Retention days
- Case templates editor (Canonical §30)

### Agent Actions — `src/lib/actions/helpdesk-agent.ts`

All actions require staff authorization via `staffAuthorize()`.

**`createTeam(formData)`**
**`updateTeam(teamId, formData)`**
**`addTeamMember(teamId, staffUserId)`**
**`removeTeamMember(teamId, staffUserId)`**
**`toggleTeamMemberAvailability(teamId, staffUserId, isAvailable)`**

**`createRoutingRule(formData)`**
**`updateRoutingRule(ruleId, formData)`**
**`reorderRoutingRules(orderedIds: string[])`**
**`toggleRoutingRule(ruleId, isActive)`**

**`createMacro(formData)`**
**`updateMacro(macroId, formData)`**
**`deleteMacro(macroId)`**
**`applyMacro(caseId, macroId)`** — Resolves template variables, returns composed body for agent to review

**`createSavedView(formData)`**
**`updateSavedView(viewId, formData)`**
**`deleteSavedView(viewId)`**

**`updateSlaPolicyTargets(policyId, firstResponseMinutes, resolutionMinutes)`**

**`createAutomationRule(formData)`**
**`updateAutomationRule(ruleId, formData)`**
**`toggleAutomationRule(ruleId, isActive)`**

**`mergeCases(sourceCaseId, targetCaseId)`** — Per Canonical §28
1. Verify restrictions (§28.3): target not CLOSED, not self, not chain-merge, max 5
2. Copy all messages from source into target (set fromMergedCaseId)
3. Copy all events from source into target
4. Copy watchers, commerce links (union), tags
5. Set source status = CLOSED, mergedIntoCaseId = targetId
6. Insert events on both cases (merged_from, merged_into)

**`addCaseWatcher(caseId, staffUserId)`**
**`removeCaseWatcher(caseId, staffUserId)`**

---

# G9.5 — Knowledge Base (Editor + Public Help Center + Search)

## Prerequisites
- G9.1 complete

## Scope

### KB Admin Pages (hub.twicely.co/kb/*)

**`/kb` — Article List (replace existing placeholder)**
Route: `src/app/(hub)/kb/page.tsx`
Gate: STAFF(HELPDESK_LEAD+, ADMIN)

- Table: Title, Category, Status badge, Audience, Views, Helpful %, Updated, Author
- Filters: Status, Category, Audience
- Search by title/content
- Create article button -> /kb/new

**`/kb/new` — New Article**
Route: `src/app/(hub)/kb/new/page.tsx`
Gate: STAFF(HELPDESK_LEAD+, ADMIN)

- Editor: rich text editor (use textarea with markdown preview for MVP — editor choice TBD per Canonical §21.3)
- Sidebar fields: category, audience, tags, search keywords, SEO fields, featured toggle, pinned toggle
- Toolbar: Save Draft, Submit for Review, Publish (HELPDESK_MANAGER+ only), Preview
- Related articles selector

**`/kb/[id]/edit` — Edit Article**
Route: `src/app/(hub)/kb/[id]/edit/page.tsx`
Gate: STAFF(HELPDESK_LEAD+, ADMIN)

- Same editor as new
- Status transition controls based on current status
- Version display

**`/kb/categories` — Category Management**
Route: `src/app/(hub)/kb/categories/page.tsx`
Gate: STAFF(HELPDESK_MANAGER, ADMIN)

- Category tree (2 levels max)
- Create/edit/reorder categories
- Each: name, slug, description, icon, sortOrder, isActive

### KB Actions — `src/lib/actions/kb-articles.ts`

**`createKbArticle(formData)`**
**`updateKbArticle(articleId, formData)`**
**`publishKbArticle(articleId)`** — Status -> PUBLISHED, set publishedAt, increment version
**`archiveKbArticle(articleId)`** — Status -> ARCHIVED
**`submitForReview(articleId)`** — Status -> REVIEW

**`createKbCategory(formData)`**
**`updateKbCategory(categoryId, formData)`**
**`reorderKbCategories(orderedIds: string[])`**

**`linkArticleToCase(caseId, articleId, sentToCustomer)`**
**`submitArticleFeedback(formData)`** — Public (guest or auth)

### KB Queries — `src/lib/queries/kb-articles.ts`

**`getPublicKbCategories(userAudience)`** — For help center home
- Filter: isActive = true, audience matches user
- Include article count per category

**`getKbArticlesByCategory(categorySlug, userAudience)`** — For category page
- Filter: status = PUBLISHED, audience matches user
- Sorted by sortOrder, then title

**`getKbArticleBySlug(slug, userAudience)`** — For article page
- Filter: status = PUBLISHED, audience matches user
- Include related articles
- Increment view count (debounced)

**`getFeaturedKbArticles(userAudience)`** — For help center home
- Filter: isFeatured = true, status = PUBLISHED, audience matches

**`searchKbArticles(query, userAudience)`** — Typesense search
- Search published articles matching audience
- Return: title, excerpt, category, slug

**`getAdminKbArticles(filters?)`** — For KB admin list
- All statuses
- Filterable, paginated

**`getSuggestedKbArticles(caseType, tags)`** — For case context panel
- Match articles by type-to-category mapping + tags
- Return top 3-5 articles

### Public Help Center Pages

**`/h` — Help Center Home (replace existing placeholder)**
Route: `src/app/(marketplace)/h/page.tsx`
Layout: marketplace
Gate: PUBLIC

Per Canonical §14.1:
- Search bar with typeahead (Typesense kb_articles index)
- Category grid (each links to `/h/[slug]`)
- Popular/featured articles
- "Still need help? [Contact Support]"
- Server-rendered for SEO

**`/h/[category-slug]` — Category Page (replace existing placeholder)**
Route: `src/app/(marketplace)/h/[category-slug]/page.tsx`
Layout: marketplace
Gate: PUBLIC

Per Canonical §14.2:
- Category title + description
- Subcategories (if any)
- Article list with title + excerpt
- Breadcrumb: Help Center > Category

**`/h/[category-slug]/[article-slug]` — Article Page (replace existing placeholder)**
Route: `src/app/(marketplace)/h/[category-slug]/[article-slug]/page.tsx`
Layout: marketplace
Gate: PUBLIC (audience-gated: ALL only for guests)

Per Canonical §14.3:
- Title, body (rendered markdown/HTML), last updated date
- Sidebar: related articles, table of contents
- Bottom: "Was this article helpful?" Yes/No
- Bottom: "Still need help? [Contact Support]"
- Server-rendered for SEO with proper meta tags
- JSON-LD: `Article` schema

### Audience Gating (Canonical §14.4)

| Audience | Visible To |
|----------|------------|
| ALL | Everyone (including guests) |
| BUYER | Authenticated users |
| SELLER | Users with seller profile |
| AGENT_ONLY | Only visible in helpdesk context panel, NOT on public help center |

---

# G9.6 — Advanced Features (SLA Cron, Routing, Automation, CSAT, Merge, Reports, Collision)

## Prerequisites
- G9.4 complete

## Scope

### Background Jobs

Create `src/lib/jobs/helpdesk-auto-close.ts`:
- BullMQ job on `helpdesk` queue
- Runs every 15 minutes
- Close PENDING_USER cases past `helpdesk.autoClose.pendingUserDays` threshold
- Close RESOLVED cases past `helpdesk.autoClose.resolvedDays` threshold
- Insert caseEvent for each auto-close

Create `src/lib/jobs/helpdesk-sla-check.ts`:
- BullMQ job on `helpdesk` queue
- Runs every 5 minutes
- Calculate SLA countdowns for all active cases
- At 75% elapsed: set warning flag, insert caseEvent, send `helpdesk.agent.sla_warning` notification
- At 100% elapsed (breach): set breached flag, insert caseEvent, send `helpdesk.agent.sla_breach` notification
- If escalateOnBreach on SLA policy: trigger escalation (change status to ESCALATED, reassign to escalations team)

Create `src/lib/jobs/helpdesk-csat-send.ts`:
- BullMQ job on `helpdesk` queue
- Runs every 5 minutes
- Find cases resolved in the last hour where CSAT not yet requested
- If `helpdesk.csat.enabled` and past `helpdesk.csat.surveyDelayMinutes` delay
- Insert caseCsat record with surveyRequestedAt = now, rating = null
- Send `helpdesk.csat.request` email

### Automation Engine — `src/lib/helpdesk/automation-engine.ts`

**`evaluateAutomationRules(triggerEvent, caseData)`**
1. Load all active automation rules matching triggerEvent
2. For each rule, evaluate conditionsJson against case data
3. Execute actionsJson for each matching rule:
   - SET_PRIORITY: update case priority
   - ASSIGN_TEAM: update case team
   - ASSIGN_AGENT: update case agent
   - ADD_TAGS / REMOVE_TAGS: modify tags array
   - SET_STATUS: update case status
   - SEND_NOTIFICATION: queue notification
   - ADD_NOTE: insert system internal note
4. All actions create caseEvent records

### Agent Collision Detection — `src/lib/helpdesk/collision.ts`

Per Canonical §29, this is Centrifugo-based. Implementation:
- On case detail page mount: publish `agent_viewing` event to `private-case.{caseId}` channel
- On compose area focus: publish `agent_typing_reply` event
- On 3s idle in compose: publish `agent_stopped_typing`
- On navigation away / `beforeunload`: publish `agent_left`
- UI shows: "Sarah is also viewing" bar, "Sarah is typing a reply..." warning
- On `agent_sent_reply` event: show toast "Sarah just sent a reply"
- Heartbeat every 60s, auto-expire after 5 minutes idle

**NOTE:** Collision detection requires Centrifugo to be running. If Centrifugo is not yet wired for hub pages, this feature should degrade gracefully (no errors, just no presence indicators).

### Reports Queries — `src/lib/queries/helpdesk-reports.ts`

**`getHelpdeskDashboardMetrics(dateRange)`**
- Open cases count by status
- Avg first response time (rolling 30d)
- Avg resolution time (rolling 30d)
- SLA compliance % (first response + resolution)
- CSAT average rating (rolling 30d)
- Cases by type (counts)
- Cases by channel (counts)
- Agent workload (open cases per agent)

**`getHelpdeskVolumeReport(dateRange, filters)`**
**`getHelpdeskSlaReport(dateRange, filters)`**
**`getHelpdeskAgentPerformanceReport(dateRange, filters)`**
**`getHelpdeskCsatReport(dateRange, filters)`**

---

## CONSTRAINTS — WHAT NOT TO DO

### Banned Terms
- NEVER use `ticket` or `support_ticket` — use `case` and `helpdeskCase`
- NEVER use `TicketType`, `TicketStatus`, `TicketPriority` — use `CaseType`, `CaseStatus`, `CasePriority`
- NEVER use `SUPPORT_AGENT` — use `HELPDESK_AGENT`
- NEVER use `/helpdesk/*` routes — use `/hd/*` (Actors/Security Canonical uses `/helpdesk/*` but Page Registry corrects to `/hd/*`)
- All banned terms from CLAUDE.md: no `SellerTier`, no `FVF`, no `wallet`, etc.

### Tech Stack
- Use BullMQ on `helpdesk` queue for background jobs (NOT Bull, NOT cron-only)
- Use Centrifugo for real-time (NOT polling, NOT Pusher)
- Use Typesense for KB search (NOT Meilisearch)
- Use React Email + Resend for email (NOT Nodemailer)
- Use Drizzle ORM for all DB access (NOT Prisma)
- Use CASL for authorization (NOT custom RBAC)
- Use Cloudflare R2 for attachments (NOT MinIO)

### Route Enforcement
- `/hd/*` — helpdesk agent workspace (hub.twicely.co)
- `/kb/*` — KB admin editor (hub.twicely.co)
- `/h/*` — public help center (twicely.co)
- `/h/contact` — submit case form (twicely.co)
- `/my/support/*` — user case tracking (twicely.co)

### Code Patterns
- `strict: true` TypeScript, zero `as any`, zero `@ts-ignore`
- Max 300 lines per file
- Zod `.strict()` on all input schemas
- Explicit field mapping (never spread request body)
- Staff actions via `staffAuthorize()`, user actions via `authorize()`
- `userId` as ownership key throughout
- No `console.log` in production code

---

## ACCEPTANCE CRITERIA

### G9.1
- [ ] All CASL subjects added and tested
- [ ] 5 helpdesk teams seeded with correct data
- [ ] 5 SLA policies seeded (one per priority)
- [ ] 7 routing rules seeded with correct conditions
- [ ] 5 automation rules seeded
- [ ] 8 KB categories seeded with correct slugs/icons/audiences
- [ ] 14 helpdesk platform settings seeded
- [ ] 1 sequence counter seeded (helpdesk_case, HD-, 6)
- [ ] 6 case templates seeded as platform settings
- [ ] 11 notification templates defined
- [ ] All Zod schemas created with `.strict()`
- [ ] If migration added: `lastActivityAt` column exists on helpdeskCase

### G9.2
- [ ] `createCase()` generates sequential case numbers (HD-000001, HD-000002...)
- [ ] Case creation evaluates routing rules and assigns team/agent
- [ ] SLA deadlines calculated from SLA policy on case creation
- [ ] Agent reply sets firstResponseAt on first outbound message
- [ ] User reply to PENDING_USER case transitions to OPEN
- [ ] Status transitions follow lifecycle (no arbitrary jumps)
- [ ] Resolved case sets resolvedAt timestamp
- [ ] Case reopen works within window, fails outside window
- [ ] CSAT can only be submitted once per case
- [ ] Routing engine evaluates rules in sortOrder, first match wins
- [ ] Round-robin assigns to least-loaded available agent

### G9.3
- [ ] `/h/contact` form validates all fields, creates case, redirects to case detail
- [ ] `/my/support` shows user's cases with correct status labels
- [ ] `/my/support/[caseId]` shows messages (NOT internal notes), events, reply form
- [ ] CSAT prompt appears on resolved cases
- [ ] Reopen button appears within window, hidden outside
- [ ] Pre-fill works from "Get Help" entry points
- [ ] Unauthenticated users cannot access `/my/support/*`
- [ ] Users cannot see other users' cases

### G9.4
- [ ] Helpdesk uses separate full-screen layout (NOT nested in hub admin layout)
- [ ] Case queue shows default views (My Cases, Unassigned, All Open, SLA Breached, Resolved)
- [ ] Case detail three-column layout works
- [ ] Context panel auto-loads commerce data based on linked IDs
- [ ] Agent can reply, add internal note, change status/priority/agent/team/tags
- [ ] Internal notes hidden from user-facing case detail
- [ ] Macro picker resolves template variables
- [ ] Merge follows all restrictions from Canonical §28.3
- [ ] Sidebar items gated by helpdesk role (Agent/Lead/Manager)
- [ ] Bulk actions work (max 50)

### G9.5
- [ ] `/h` shows category grid, featured articles, search bar
- [ ] `/h/[category-slug]` shows articles filtered by audience
- [ ] `/h/[category-slug]/[article-slug]` renders markdown/HTML body
- [ ] Article feedback (helpful yes/no) works, one per user per article
- [ ] AGENT_ONLY articles NOT visible on public help center
- [ ] KB admin list shows all articles with status/audience/views/helpful%
- [ ] KB editor creates/edits articles with sidebar fields
- [ ] Publish sets status + publishedAt + increments version
- [ ] Category management works (CRUD, reorder, 2 levels max)
- [ ] KB articles are server-rendered with proper SEO meta tags

### G9.6
- [ ] Auto-close job closes stale PENDING_USER and RESOLVED cases
- [ ] SLA check job flags warnings at 75% and breaches at 100%
- [ ] SLA breach triggers escalation for CRITICAL/URGENT priorities
- [ ] CSAT survey sent after configurable delay
- [ ] Automation rules fire on correct trigger events
- [ ] Reports dashboard shows accurate metrics
- [ ] Collision detection shows "X is viewing" and "X is typing" (or degrades gracefully without Centrifugo)

### Authorization (all sub-steps)
- [ ] Unauthenticated users cannot create cases (redirected to login)
- [ ] Users can only read their own cases (requesterId match)
- [ ] HELPDESK_AGENT can read/create/update cases but NOT manage teams/routing/SLA/automation
- [ ] HELPDESK_LEAD can + manage macros and KB articles
- [ ] HELPDESK_MANAGER can + manage teams, routing, SLA, automation, settings
- [ ] ADMIN can manage everything
- [ ] No CASL subject is missing for any entity accessed

### Vocabulary
- [ ] Zero occurrences of "ticket" in UI copy or code names (use "case")
- [ ] Zero occurrences of banned terms from CLAUDE.md
- [ ] Route prefixes correct: `/hd/*`, `/kb/*`, `/h/*`, `/my/support/*`
- [ ] Status labels user-friendly per Canonical §3.4

---

## TEST REQUIREMENTS

### G9.1 Tests (~20)
- `src/lib/db/seed/__tests__/seed-helpdesk.test.ts` — verify all seed data correct
- `src/lib/casl/__tests__/helpdesk-abilities.test.ts` — CASL subjects and permissions
- `src/lib/validations/__tests__/helpdesk-schemas.test.ts` — Zod schema validation

### G9.2 Tests (~40)
- `src/lib/actions/__tests__/helpdesk-cases.test.ts` — case creation, reply, status transitions
- `src/lib/helpdesk/__tests__/routing.test.ts` — routing rule evaluation, round-robin
- `src/lib/helpdesk/__tests__/sla.test.ts` — SLA calculation, business hours
- `src/lib/helpdesk/__tests__/case-number.test.ts` — sequential number generation
- `src/lib/actions/__tests__/helpdesk-csat.test.ts` — CSAT submission

### G9.3 Tests (~25)
- `src/lib/queries/__tests__/helpdesk-cases.test.ts` — user case queries
- Component tests for support pages (form validation, status labels, timeline rendering)

### G9.4 Tests (~30)
- `src/lib/actions/__tests__/helpdesk-agent.test.ts` — team CRUD, macro CRUD, routing CRUD
- `src/lib/actions/__tests__/helpdesk-merge.test.ts` — merge cases with all restrictions
- `src/lib/queries/__tests__/helpdesk-agent-queue.test.ts` — queue filtering/sorting
- `src/lib/queries/__tests__/helpdesk-context.test.ts` — context panel data loading

### G9.5 Tests (~35)
- `src/lib/actions/__tests__/kb-articles.test.ts` — article CRUD, publish lifecycle
- `src/lib/queries/__tests__/kb-articles.test.ts` — public queries, audience gating
- `src/lib/actions/__tests__/kb-feedback.test.ts` — article feedback (helpful/not helpful)
- Component tests for help center pages (category grid, article rendering, feedback widget)

### G9.6 Tests (~35)
- `src/lib/jobs/__tests__/helpdesk-auto-close.test.ts` — auto-close logic
- `src/lib/jobs/__tests__/helpdesk-sla-check.test.ts` — SLA warning + breach logic
- `src/lib/jobs/__tests__/helpdesk-csat-send.test.ts` — CSAT survey sending
- `src/lib/helpdesk/__tests__/automation-engine.test.ts` — automation rule evaluation
- `src/lib/queries/__tests__/helpdesk-reports.test.ts` — report metrics

---

## FILE APPROVAL LIST

### G9.1 (~15 files)
| File | Description |
|------|-------------|
| `drizzle/XXXX_helpdesk-last-activity.sql` | Migration: add lastActivityAt to helpdeskCase |
| `src/lib/db/schema/helpdesk.ts` | MODIFY: add lastActivityAt column |
| `src/lib/casl/subjects.ts` | MODIFY: add 10 new CASL subjects |
| `src/lib/casl/buyer-abilities.ts` | MODIFY: add KbArticle/KbCategory/CaseCsat abilities |
| `src/lib/casl/platform-abilities.ts` | MODIFY: add helpdesk role-specific abilities |
| `src/lib/casl/system-role-defaults.ts` | MODIFY: add helpdesk subjects to role defaults |
| `src/lib/validations/helpdesk.ts` | NEW: all Zod schemas for helpdesk + KB |
| `src/lib/notifications/templates-helpdesk.ts` | NEW: 11 notification templates |
| `src/lib/db/seed/seed-helpdesk.ts` | NEW: teams, SLA, routing, automation, KB categories, sequence counter |
| `src/lib/db/seed/v32-platform-settings-extended.ts` | MODIFY: add 14+6 helpdesk settings |
| `src/lib/db/seed/seed-platform.ts` | MODIFY: import and run helpdesk seed |
| `src/lib/casl/__tests__/helpdesk-abilities.test.ts` | NEW: CASL permission tests |
| `src/lib/validations/__tests__/helpdesk-schemas.test.ts` | NEW: Zod validation tests |
| `src/lib/db/seed/__tests__/seed-helpdesk.test.ts` | NEW: seed data verification |

### G9.2 (~12 files)
| File | Description |
|------|-------------|
| `src/lib/actions/helpdesk-cases.ts` | NEW: createCase, addUserReply, addAgentReply, updateCaseStatus, assignCase, etc. |
| `src/lib/actions/helpdesk-csat.ts` | NEW: submitCsat action |
| `src/lib/queries/helpdesk-cases.ts` | NEW: getCasesByRequester, getCaseDetail, getAgentCaseQueue, etc. |
| `src/lib/helpdesk/routing.ts` | NEW: evaluateRoutingRules + round-robin assignment |
| `src/lib/helpdesk/sla.ts` | NEW: calculateSlaDue + business hours logic |
| `src/lib/helpdesk/case-number.ts` | NEW: generateCaseNumber via sequenceCounter |
| `src/lib/helpdesk/macro-resolver.ts` | NEW: resolveTemplateVariables for macros |
| `src/lib/actions/__tests__/helpdesk-cases.test.ts` | NEW: case action tests |
| `src/lib/actions/__tests__/helpdesk-csat.test.ts` | NEW: CSAT tests |
| `src/lib/helpdesk/__tests__/routing.test.ts` | NEW: routing engine tests |
| `src/lib/helpdesk/__tests__/sla.test.ts` | NEW: SLA calculator tests |
| `src/lib/helpdesk/__tests__/case-number.test.ts` | NEW: case number generator tests |

### G9.3 (~10 files)
| File | Description |
|------|-------------|
| `src/app/(marketplace)/h/contact/page.tsx` | REPLACE: full contact form with case creation |
| `src/app/(marketplace)/my/support/page.tsx` | NEW: user support cases list |
| `src/app/(marketplace)/my/support/[caseId]/page.tsx` | NEW: user case detail + reply + CSAT |
| `src/components/support/contact-form.tsx` | NEW: case submission form component |
| `src/components/support/case-timeline.tsx` | NEW: message + event timeline component |
| `src/components/support/csat-prompt.tsx` | NEW: CSAT rating widget |
| `src/components/support/status-badge.tsx` | NEW: user-friendly status badge |
| `src/lib/queries/__tests__/helpdesk-cases.test.ts` | EXTEND: user query tests |

### G9.4 (~20 files)
| File | Description |
|------|-------------|
| `src/app/(hub)/hd/layout.tsx` | NEW: helpdesk full-screen layout + sidebar |
| `src/app/(hub)/hd/page.tsx` | REPLACE: case queue with filters + views |
| `src/app/(hub)/hd/cases/[id]/page.tsx` | NEW: three-column case detail |
| `src/app/(hub)/hd/views/page.tsx` | NEW: saved views management |
| `src/app/(hub)/hd/macros/page.tsx` | NEW: macro library |
| `src/app/(hub)/hd/teams/page.tsx` | NEW: team management |
| `src/app/(hub)/hd/routing/page.tsx` | NEW: routing rules |
| `src/app/(hub)/hd/sla/page.tsx` | NEW: SLA policies |
| `src/app/(hub)/hd/automation/page.tsx` | NEW: automation rules |
| `src/app/(hub)/hd/reports/page.tsx` | NEW: reports dashboard |
| `src/app/(hub)/hd/settings/page.tsx` | NEW: helpdesk settings |
| `src/components/helpdesk/case-properties-panel.tsx` | NEW: left column component |
| `src/components/helpdesk/case-conversation.tsx` | NEW: center column component |
| `src/components/helpdesk/case-context-panel.tsx` | NEW: right column component |
| `src/components/helpdesk/case-compose.tsx` | NEW: compose area with tabs |
| `src/components/helpdesk/helpdesk-sidebar.tsx` | NEW: helpdesk nav sidebar |
| `src/lib/actions/helpdesk-agent.ts` | NEW: team/macro/routing/view/SLA CRUD |
| `src/lib/queries/helpdesk-agent-queue.ts` | NEW: agent queue queries |
| `src/lib/queries/helpdesk-context.ts` | NEW: context panel data loader |
| `src/lib/actions/__tests__/helpdesk-agent.test.ts` | NEW: agent action tests |

### G9.5 (~15 files)
| File | Description |
|------|-------------|
| `src/app/(marketplace)/h/page.tsx` | REPLACE: help center home with search + categories |
| `src/app/(marketplace)/h/[category-slug]/page.tsx` | REPLACE: category page with articles |
| `src/app/(marketplace)/h/[category-slug]/[article-slug]/page.tsx` | REPLACE: article page with full render + feedback |
| `src/app/(hub)/kb/page.tsx` | REPLACE: article list with admin table |
| `src/app/(hub)/kb/new/page.tsx` | NEW: article editor |
| `src/app/(hub)/kb/[id]/edit/page.tsx` | NEW: edit article |
| `src/app/(hub)/kb/categories/page.tsx` | NEW: category management |
| `src/components/kb/article-editor.tsx` | NEW: KB article editor form |
| `src/components/kb/article-feedback.tsx` | NEW: "Was this helpful?" widget |
| `src/components/kb/kb-search.tsx` | NEW: KB search bar with typeahead |
| `src/lib/actions/kb-articles.ts` | NEW: article CRUD, publish, feedback |
| `src/lib/queries/kb-articles.ts` | NEW: public + admin article queries |
| `src/lib/actions/__tests__/kb-articles.test.ts` | NEW: article action tests |
| `src/lib/queries/__tests__/kb-articles.test.ts` | NEW: query tests |
| `src/lib/actions/__tests__/kb-feedback.test.ts` | NEW: feedback tests |

### G9.6 (~10 files)
| File | Description |
|------|-------------|
| `src/lib/jobs/helpdesk-auto-close.ts` | NEW: auto-close cron job |
| `src/lib/jobs/helpdesk-sla-check.ts` | NEW: SLA check cron job |
| `src/lib/jobs/helpdesk-csat-send.ts` | NEW: CSAT survey sender |
| `src/lib/helpdesk/automation-engine.ts` | NEW: automation rule evaluator |
| `src/lib/helpdesk/collision.ts` | NEW: Centrifugo collision helpers |
| `src/lib/queries/helpdesk-reports.ts` | NEW: report metrics queries |
| `src/lib/jobs/__tests__/helpdesk-auto-close.test.ts` | NEW: auto-close tests |
| `src/lib/jobs/__tests__/helpdesk-sla-check.test.ts` | NEW: SLA check tests |
| `src/lib/jobs/__tests__/helpdesk-csat-send.test.ts` | NEW: CSAT send tests |
| `src/lib/helpdesk/__tests__/automation-engine.test.ts` | NEW: automation tests |

**TOTAL: ~82 files (48 new, 14 modified, 20 test files)**

---

## VERIFICATION CHECKLIST

After each sub-step, run:

```bash
./twicely-lint.sh
```

Expected outcomes:
1. TypeScript: 0 errors
2. Test count: >= BASELINE_TESTS (must not decrease)
3. Banned terms: 0 occurrences
4. Route prefixes: all correct
5. File sizes: all <= 300 lines
6. No `console.log` in production code

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-15 | Initial G9 install prompt. Full helpdesk + KB specification with 6 sub-steps. |

---

**END OF INSTALL PROMPT — G9-helpdesk-knowledge-base.md**
