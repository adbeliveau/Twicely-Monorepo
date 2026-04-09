# TWICELY HELPDESK V1 — CANONICAL SPECIFICATION
**Status:** LOCKED (v2.0) — Aligned with UI Addendum v2 (full-screen layout)
**Type:** New Phase (Phase 45)
**Prereq:** Phase 44 complete and Doctor green
**Replaces:** Phase 30 Customer Support Console (absorbed + extended)
**Absorbs:** Helpdesk-relevant parts of Phase 14, 21, 27, 28, 30
**Backend-first:** Schema → Service → Email Inbound → Routing → SLA → Automation → RBAC → Health → Doctor → UI

---

## 0) Vision

One system where every buyer problem, seller issue, dispute, return, chargeback, flagged message, and platform incident lands as a **Case** — routed to the right agent, enriched with full commerce context, trackable by SLA, and resolvable without leaving the helpdesk.

This is not a generic helpdesk bolted onto a marketplace.
This is a marketplace-native helpdesk where the commerce data IS the support data.

### What makes this "best ever built"
1. **Commerce-aware** — every case auto-links to orders, listings, payments, payouts, shipments, trust scores, seller standards
2. **Omnichannel intake** — web form, email (SES inbound), system-generated, escalated from disputes/returns
3. **Unified timeline** — email replies, internal notes, system events, status changes, automation actions all in one thread
4. **Workflow engine** — configurable routing rules, auto-assignment, auto-escalation, SLA enforcement
5. **Agent workspace** — Zendesk-quality UX with Twicely-native context panel
6. **Email-first reply** — agents reply from helpdesk, user gets email, user replies to email, it threads back in
7. **Ready for real-time later** — architecture supports adding WebSocket chat as a channel without refactoring

---

## 1) Architecture Principles

### 1.1 Everything is a Case
A Case is the universal container. It replaces the concept of "ticket" and unifies:

| Old concept | New reality |
|-------------|-------------|
| SupportTicket (Phase 30) | → Case (type: SUPPORT) |
| DisputeCase (Phase 14) | → Case (type: DISPUTE) — OR linked as `case.disputeCaseId` |
| ReturnCase (Phase 14) | → Case (type: RETURN) — OR linked as `case.returnCaseId` |
| ChargebackCase (Phase 33) | → Case (type: CHARGEBACK) — OR linked as `case.chargebackCaseId` |
| Flagged Message (Phase 27) | → Case (type: MODERATION) |
| System alert | → Case (type: SYSTEM) |

**Decision: Link, don't duplicate.**
Disputes, returns, and chargebacks keep their existing models (they have complex state machines). The helpdesk Case links to them via foreign keys and provides the **agent workflow layer** on top. The existing models remain the source of truth for business logic. The Case is the source of truth for agent workflow.

### 1.2 Channels are input pipes, not separate systems
Every channel writes `CaseMessage` objects into the same timeline:

| Channel | How it arrives |
|---------|---------------|
| `WEB` | User clicks "Get Help" in Twicely |
| `EMAIL` | User emails support@twicely.com → SES inbound → parser → CaseMessage |
| `INTERNAL` | Staff note (not visible to user) |
| `SYSTEM` | Automated event (status change, SLA breach, auto-action) |
| `CHAT` | (Future) WebSocket message → CaseMessage — channel: CHAT |

### 1.3 Email is a first-class channel
- Outbound: agent replies → SES sends email to user with reply-to header
- Inbound: user replies to email → SES receipt rule → parser → CaseMessage
- Threading: `In-Reply-To` / `References` headers + `case+{caseId}@support.twicely.com` reply-to address

### 1.4 Existing models are kept, not replaced
The helpdesk does NOT replace DisputeCase, ReturnCase, ChargebackCase, Conversation, or Message models. It wraps them in a unified agent workflow. Those models continue to own their state machines and business logic.

---

## 2) Prisma Schema

### 2.1 Core Case Model

```prisma
// =============================================================================
// HELPDESK — CASE (Universal container)
// =============================================================================

enum CaseType {
  SUPPORT        // General support inquiry
  DISPUTE        // Linked to DisputeCase
  RETURN         // Linked to ReturnCase
  CHARGEBACK     // Linked to ChargebackCase
  MODERATION     // Flagged content
  SYSTEM         // Platform-generated
  ACCOUNT        // Account issues (verification, suspension)
  BILLING        // Subscription/fee questions
}

enum CaseStatus {
  NEW            // Just created, unassigned
  OPEN           // Assigned, being worked
  PENDING_USER   // Waiting for buyer/seller response
  PENDING_INTERNAL // Waiting for internal action (finance, trust, etc.)
  ON_HOLD        // Paused (vacation, dependency)
  ESCALATED      // Escalated to senior/manager
  RESOLVED       // Agent resolved
  CLOSED         // Confirmed closed (auto or manual)
}

enum CasePriority {
  CRITICAL       // Platform outage, fraud, safety — 1 hour SLA
  URGENT         // Chargeback, payment failure — 4 hour SLA
  HIGH           // Active dispute, stuck payout — 12 hour SLA
  NORMAL         // General support — 24 hour SLA
  LOW            // Feature question, feedback — 48 hour SLA
}

enum CaseChannel {
  WEB            // Submitted via Twicely UI
  EMAIL          // Received via email
  SYSTEM         // Auto-generated by platform
  INTERNAL       // Created by staff
  CHAT           // (Future) Real-time chat
}

model HelpdeskCase {
  id                  String        @id @default(cuid())
  caseNumber          String        @unique  // Human-readable: HD-000001
  
  // Type & channel
  type                CaseType
  channel             CaseChannel   @default(WEB)
  
  // Status & priority
  status              CaseStatus    @default(NEW)
  priority            CasePriority  @default(NORMAL)
  
  // Subject & category
  subject             String
  category            String?       // order_issue, payment, shipping, account, etc.
  subcategory         String?       // damaged, late, wrong_item, etc.
  tags                String[]      @default([])
  
  // Actors
  contactUserId       String?       // The user who needs help (buyer or seller)
  contactType         String?       // buyer | seller | guest
  contactEmail        String?       // For email-only contacts (no account)
  
  // Commerce links (the power of a marketplace-native helpdesk)
  orderId             String?
  listingId           String?
  sellerId            String?       // The seller involved (may differ from contactUserId)
  payoutId            String?
  shipmentId          String?
  
  // Linked case models (existing Phase 14/33 models)
  disputeCaseId       String?       // → DisputeCase.id
  returnCaseId        String?       // → ReturnCase.id
  chargebackCaseId    String?       // → ChargebackCase.id
  conversationId      String?       // → Conversation.id (Phase 21)
  
  // Assignment
  assignedToStaffId   String?
  assignedToTeam      String?       // support, trust, finance, escalations
  previousAssigneeId  String?       // Track reassignment
  
  // SLA
  slaDueAt            DateTime?
  slaBreached         Boolean       @default(false)
  firstResponseAt     DateTime?     // When agent first replied
  firstResponseSlaAt  DateTime?     // When first response was due
  
  // Resolution
  resolvedAt          DateTime?
  closedAt            DateTime?
  resolution          String?       // Free text resolution summary
  resolutionCategory  String?       // resolved_with_refund, resolved_no_action, etc.
  satisfactionRating  Int?          // 1-5 from user after close
  satisfactionComment String?
  
  // Email threading
  emailThreadId       String?       // For grouping email replies
  lastInboundEmailAt  DateTime?     // Track email responsiveness
  
  // Metadata
  sourceUrl           String?       // Page user was on when they submitted
  userAgent           String?
  ipAddress           String?
  customFields        Json          @default("{}")
  
  // Counters (denormalized for performance)
  messageCount        Int           @default(0)
  internalNoteCount   Int           @default(0)
  
  // Timestamps
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  // Relations
  messages            CaseMessage[]
  events              CaseEvent[]
  watchers            CaseWatcher[]

  @@index([status, priority, createdAt])
  @@index([contactUserId, createdAt])
  @@index([sellerId, createdAt])
  @@index([assignedToStaffId, status])
  @@index([assignedToTeam, status])
  @@index([orderId])
  @@index([disputeCaseId])
  @@index([returnCaseId])
  @@index([chargebackCaseId])
  @@index([slaDueAt, slaBreached])
  @@index([emailThreadId])
  @@index([type, status, createdAt])
  @@index([caseNumber])
}
```

### 2.2 Case Messages (Unified Timeline)

```prisma
// =============================================================================
// HELPDESK — CASE MESSAGE (Unified timeline entry)
// =============================================================================

enum CaseMessageChannel {
  WEB            // User submitted via form
  EMAIL          // Arrived via email
  INTERNAL       // Staff note (hidden from user)
  SYSTEM         // Automated message
  CHAT           // (Future) real-time
}

enum CaseMessageDirection {
  INBOUND        // From user to helpdesk
  OUTBOUND       // From agent to user
  INTERNAL       // Between staff
  SYSTEM         // Platform-generated
}

model CaseMessage {
  id                  String                @id @default(cuid())
  caseId              String
  case                HelpdeskCase          @relation(fields: [caseId], references: [id], onDelete: Cascade)
  
  // Who sent it
  authorId            String?               // userId or staffId
  authorType          String                // user | staff | system
  authorName          String?               // Display name (cached for email senders)
  authorEmail         String?               // Email address (for email channel)
  
  // Channel & direction
  channel             CaseMessageChannel
  direction           CaseMessageDirection
  
  // Content
  subject             String?               // Email subject (if from email)
  bodyText            String                // Plain text version
  bodyHtml            String?               // Rich HTML version (from email or rich editor)
  
  // Email metadata
  emailMessageId      String?               // RFC 822 Message-ID
  emailInReplyTo      String?               // In-Reply-To header
  emailReferences     String[]              @default([])
  
  // Attachments
  attachments         CaseAttachment[]
  
  // Macro used
  macroId             String?               // If sent via macro
  
  // Visibility
  isInternal          Boolean               @default(false)
  isAutoReply         Boolean               @default(false)
  
  // Delivery status (for outbound email)
  emailDeliveryStatus String?               // queued | sent | delivered | bounced | failed
  emailSentAt         DateTime?
  emailDeliveredAt    DateTime?
  emailBouncedAt      DateTime?
  
  createdAt           DateTime              @default(now())

  @@index([caseId, createdAt])
  @@index([authorId, createdAt])
  @@index([emailMessageId])
  @@index([channel, createdAt])
}
```

### 2.3 Case Attachments

```prisma
model CaseAttachment {
  id                  String        @id @default(cuid())
  messageId           String
  message             CaseMessage   @relation(fields: [messageId], references: [id], onDelete: Cascade)
  
  fileName            String
  fileType            String        // MIME type
  fileSizeBytes       Int
  storageKey          String        // S3 key
  
  createdAt           DateTime      @default(now())

  @@index([messageId])
}
```

### 2.4 Case Events (Audit Timeline)

```prisma
// =============================================================================
// HELPDESK — CASE EVENT (What happened, when, by whom)
// =============================================================================

model CaseEvent {
  id                  String        @id @default(cuid())
  caseId              String
  case                HelpdeskCase  @relation(fields: [caseId], references: [id], onDelete: Cascade)
  
  // What happened
  eventType           String        // See CaseEventType below
  
  // Who did it
  actorId             String?
  actorType           String        // staff | system | user | automation
  
  // Before/after (for status/assignment changes)
  previousValue       String?
  newValue            String?
  
  // Extra data
  metaJson            Json          @default("{}")
  
  createdAt           DateTime      @default(now())

  @@index([caseId, createdAt])
  @@index([eventType, createdAt])
}

// CaseEventType values:
// status_changed, priority_changed, assigned, reassigned, escalated,
// sla_breached, sla_warning, first_response, resolved, closed, reopened,
// merged, tagged, untagged, linked_order, linked_dispute, linked_return,
// automation_fired, macro_used, satisfaction_rated, email_sent, email_received,
// email_bounced, watcher_added, watcher_removed
```

### 2.5 Case Watchers

```prisma
model CaseWatcher {
  id                  String        @id @default(cuid())
  caseId              String
  case                HelpdeskCase  @relation(fields: [caseId], references: [id], onDelete: Cascade)
  
  staffId             String
  addedAt             DateTime      @default(now())

  @@unique([caseId, staffId])
}
```

### 2.6 Agent Teams & Routing

```prisma
// =============================================================================
// HELPDESK — TEAMS & ROUTING
// =============================================================================

model HelpdeskTeam {
  id                  String        @id @default(cuid())
  name                String        @unique // support, trust, finance, escalations
  displayName         String
  description         String?
  
  // Routing
  isDefault           Boolean       @default(false) // Catches unrouted cases
  autoAssign          Boolean       @default(true)  // Round-robin within team
  
  isActive            Boolean       @default(true)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  members             HelpdeskTeamMember[]
  rules               HelpdeskRoutingRule[]
}

model HelpdeskTeamMember {
  id                  String        @id @default(cuid())
  teamId              String
  team                HelpdeskTeam  @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  staffId             String
  role                String        @default("agent") // agent | lead | manager
  maxConcurrentCases  Int           @default(25)
  isAvailable         Boolean       @default(true)    // Online/offline toggle
  
  createdAt           DateTime      @default(now())

  @@unique([teamId, staffId])
  @@index([staffId, isAvailable])
}

model HelpdeskRoutingRule {
  id                  String        @id @default(cuid())
  teamId              String
  team                HelpdeskTeam  @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  name                String
  description         String?
  priority            Int           @default(0) // Higher = evaluated first
  isActive            Boolean       @default(true)
  
  // Conditions (evaluated as AND)
  conditionsJson      Json          // Array of { field, operator, value }
  // Examples:
  // { field: "type", operator: "eq", value: "DISPUTE" }
  // { field: "priority", operator: "in", value: ["CRITICAL","URGENT"] }
  // { field: "category", operator: "eq", value: "chargeback" }
  // { field: "contactEmail", operator: "contains", value: "@vip.com" }
  // { field: "orderTotalCents", operator: "gte", value: 50000 }
  
  // Actions
  assignToTeam        String?       // Override team assignment
  assignToStaffId     String?       // Specific agent
  setPriority         CasePriority? // Override priority
  addTags             String[]      @default([])
  
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  @@index([teamId, priority, isActive])
}
```

### 2.7 Macros (Enhanced from Phase 30)

```prisma
model HelpdeskMacro {
  id                  String        @id @default(cuid())
  
  title               String
  description         String?
  category            String?       // refund, shipping, general, dispute, etc.
  
  // What the macro does (can do multiple things at once)
  bodyText            String?       // Message body template (supports {{variables}})
  bodyHtml            String?       // Rich version
  setStatus           CaseStatus?   // Change status
  setPriority         CasePriority? // Change priority
  addTags             String[]      @default([])
  removeTags          String[]      @default([])
  assignToTeam        String?       // Reassign
  setCategory         String?
  isInternal          Boolean       @default(false) // Internal note vs reply
  
  // Access control
  teamId              String?       // Restrict to specific team
  createdByStaffId    String
  
  // Usage tracking
  useCount            Int           @default(0)
  lastUsedAt          DateTime?
  
  isActive            Boolean       @default(true)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  @@index([category, isActive])
  @@index([teamId, isActive])
}
```

### 2.8 SLA Policies

```prisma
model HelpdeskSlaPolicy {
  id                  String        @id @default(cuid())
  name                String
  description         String?
  
  priority            CasePriority
  
  // SLA targets (in minutes)
  firstResponseMinutes    Int       // Time to first agent reply
  resolutionMinutes       Int       // Time to resolution
  nextResponseMinutes     Int?      // Time between follow-ups
  
  // Business hours
  businessHoursOnly   Boolean       @default(true)
  timezone            String        @default("America/New_York")
  
  // Escalation
  warnAtPercent       Int           @default(75)  // Warn at 75% of SLA
  breachAction        String        @default("escalate") // escalate | notify | none
  
  isActive            Boolean       @default(true)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  @@unique([priority])
}
```

### 2.9 Email Configuration

```prisma
model HelpdeskEmailConfig {
  id                  String        @id @default(cuid())
  
  // Addresses
  supportEmail        String        @default("support@twicely.com")
  replyToPattern      String        @default("case+{{caseId}}@support.twicely.com")
  fromName            String        @default("Twicely Support")
  
  // SES Configuration
  sesRegion           String        @default("us-east-1")
  sesConfigurationSet String?
  
  // Auto-reply
  autoReplyEnabled    Boolean       @default(true)
  autoReplyTemplate   String?       // "We received your email..."
  autoReplyDelaySec   Int           @default(0)
  
  // Parsing rules
  stripSignatures     Boolean       @default(true)
  stripQuotedReplies  Boolean       @default(true)
  
  // Rate limiting
  maxInboundPerHour   Int           @default(100) // Per sender
  
  isActive            Boolean       @default(true)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
}
```

### 2.10 Saved Views (Agent Personalization)

```prisma
model HelpdeskView {
  id                  String        @id @default(cuid())
  
  name                String
  staffId             String?       // null = shared view
  teamId              String?       // null = all teams
  
  // Filter criteria
  filtersJson         Json          // { status: [...], priority: [...], assignedToMe: true, etc. }
  
  // Sort
  sortField           String        @default("createdAt")
  sortDirection       String        @default("desc")
  
  // Display
  columns             String[]      @default(["caseNumber","subject","status","priority","assignedTo","sla","updatedAt"])
  
  isDefault           Boolean       @default(false)
  isShared            Boolean       @default(false) // Visible to all agents
  
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  @@index([staffId])
  @@index([teamId, isShared])
}
```

---

## 3) SLA Defaults

| Priority | First Response | Resolution | Business Hours |
|----------|---------------|------------|----------------|
| CRITICAL | 30 min | 4 hours | 24/7 |
| URGENT | 1 hour | 8 hours | 24/7 |
| HIGH | 4 hours | 24 hours | Business hours |
| NORMAL | 8 hours | 48 hours | Business hours |
| LOW | 24 hours | 72 hours | Business hours |

---

## 4) Core Services

### 4.1 Case Service

```
packages/core/helpdesk/case-service.ts
```

Functions:
- `createCase(args)` — create case, apply routing rules, compute SLA, emit event
- `updateCase(caseId, updates, actorId)` — update fields, emit events for each change
- `assignCase(caseId, staffId, actorId)` — assign/reassign, update team load, emit event
- `escalateCase(caseId, actorId, reason)` — bump priority, reassign, emit event
- `resolveCase(caseId, actorId, resolution)` — set resolved, record resolution, emit event
- `closeCase(caseId, actorId)` — set closed, stop SLA timer, emit event
- `reopenCase(caseId, actorId)` — reopen, restart SLA, emit event
- `mergeCase(targetCaseId, sourceCaseId, actorId)` — merge messages, close source
- `linkCommerce(caseId, { orderId, disputeCaseId, returnCaseId, ... })` — link commerce entities

### 4.2 Message Service

```
packages/core/helpdesk/message-service.ts
```

Functions:
- `addReply(caseId, { body, authorId, channel, isInternal, macroId })` — add message to timeline, trigger outbound email if channel=EMAIL/WEB, update case status (PENDING_USER if outbound, OPEN if inbound), record firstResponseAt if first agent reply
- `addInternalNote(caseId, { body, authorId })` — add internal note, no email, no status change
- `addSystemMessage(caseId, { body, eventType })` — automated messages
- `processInboundEmail(parsedEmail)` — match to case by reply-to or create new case

### 4.3 Email Service

```
packages/core/helpdesk/email-service.ts
```

Functions:
- `sendCaseEmail(caseId, messageId)` — render email from case message, send via SES, set reply-to headers
- `parseInboundEmail(rawEmail)` — extract sender, subject, body (strip signatures/quotes), attachments, match case by `case+{id}@` address or In-Reply-To header
- `createCaseFromEmail(parsedEmail)` — new case from unmatched inbound email

### 4.4 Routing Service

```
packages/core/helpdesk/routing-service.ts
```

Functions:
- `routeCase(case)` — evaluate routing rules in priority order, assign team, optionally assign agent
- `autoAssignAgent(teamId)` — round-robin or least-loaded assignment within team
- `rebalanceTeam(teamId)` — redistribute cases when agent goes offline

### 4.5 SLA Service

```
packages/core/helpdesk/sla-service.ts
```

Functions:
- `computeSla(priority)` — return firstResponseDue and resolutionDue based on SLA policy
- `checkSlaBreaches()` — cron job, find cases approaching or past SLA, emit warnings/breaches
- `pauseSla(caseId, reason)` — pause SLA timer (ON_HOLD status)
- `resumeSla(caseId)` — resume SLA timer

### 4.6 Context Service (The Killer Feature)

```
packages/core/helpdesk/context-service.ts
```

Functions:
- `getCaseContext(caseId)` — return full enriched context for the agent panel:

```ts
type CaseContext = {
  // The case itself
  case: HelpdeskCase;
  messages: CaseMessage[];
  events: CaseEvent[];
  
  // User context
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    isSeller: boolean;
    trustScore: number | null;
    sellerStandards: { tier: string; score: number } | null;
  } | null;
  
  // Commerce context
  order: {
    id: string;
    orderNumber: string;
    status: string;
    totalCents: number;
    items: { title: string; priceCents: number; quantity: number }[];
    shipment: { status: string; trackingNumber: string; carrier: string } | null;
    payment: { status: string; method: string } | null;
  } | null;
  
  // Linked cases
  disputeCase: { id: string; status: string; reason: string; amountCents: number } | null;
  returnCase: { id: string; status: string; reason: string; refundCents: number } | null;
  chargebackCase: { id: string; status: string; amountCents: number } | null;
  
  // History
  previousCases: { id: string; caseNumber: string; subject: string; status: string; createdAt: Date }[];
  recentOrders: { id: string; orderNumber: string; status: string; totalCents: number; createdAt: Date }[];
  conversations: { id: string; orderId: string; lastMessage: string; updatedAt: Date }[];
  
  // Financial
  ledgerBalance: { availableCents: number; pendingCents: number; heldCents: number } | null;
  recentPayouts: { id: string; amountCents: number; status: string; createdAt: Date }[];
};
```

This is what Zendesk can never do. This context panel pulls from 10+ tables across your existing models and gives the agent everything they need on one screen.

---

## 5) Email Inbound Pipeline (SES)

### 5.1 Architecture

```
User replies to email
  → SES receives at support.twicely.com (MX record)
  → SES Receipt Rule
    → Store raw email in S3 (s3://twicely-helpdesk-inbound/{messageId})
    → Trigger processing (Lambda or API webhook)
  → Parser extracts:
    - Sender email
    - Subject
    - Body (stripped)
    - Attachments → S3
    - In-Reply-To header
    - case+{caseId}@ from To/CC
  → Match to existing case (by reply-to address or In-Reply-To)
  → Create CaseMessage (channel: EMAIL, direction: INBOUND)
  → Update case status to OPEN (if was PENDING_USER)
  → Notify assigned agent
```

### 5.2 New Case from Email

If no case match found:
- Create new HelpdeskCase (type: SUPPORT, channel: EMAIL)
- Match sender email to userId (if account exists)
- Apply routing rules
- Send auto-reply: "We received your email, your case number is HD-XXXXXX"

### 5.3 Outbound Email Format

```
From: Twicely Support <support@twicely.com>
Reply-To: case+{caseId}@support.twicely.com
To: {user email}
Subject: Re: {case subject} [HD-{caseNumber}]
In-Reply-To: {previous emailMessageId}
References: {email thread chain}

{agent reply body}

---
Case #{caseNumber} | Do not edit the subject line when replying
```

### 5.4 SES Configuration Requirements

- Domain: `support.twicely.com` (or `twicely.com`)
- MX record pointing to SES inbound
- SPF, DKIM, DMARC configured
- SES Receipt Rule Set active
- S3 bucket for raw email storage
- Processing endpoint (Lambda or API route)

### 5.5 Cost

| Volume | SES Cost | S3 Storage | Processing | Total |
|--------|----------|------------|------------|-------|
| 10K emails/mo | $1 | ~$0.05 | $0 (Lambda free tier) | ~$1 |
| 100K emails/mo | $10 | ~$0.50 | $0 | ~$10 |
| 1M emails/mo | $100 | ~$5 | ~$2 | ~$107 |

---

## 6) Automation Engine

### 6.1 Trigger-Based Rules

Automations fire on case events. Each automation is a stored rule:

```ts
type AutomationTrigger = 
  | "case_created"
  | "case_updated" 
  | "status_changed"
  | "priority_changed"
  | "sla_warning"      // At 75% of SLA
  | "sla_breached"
  | "no_response"      // User hasn't replied in X hours
  | "agent_idle"       // Agent hasn't replied in X hours
  | "case_reopened";

type AutomationAction =
  | { type: "set_priority"; value: CasePriority }
  | { type: "assign_team"; value: string }
  | { type: "assign_agent"; value: string }
  | { type: "add_tag"; value: string }
  | { type: "send_message"; value: { body: string; isInternal: boolean } }
  | { type: "escalate" }
  | { type: "close"; value: { resolution: string } }
  | { type: "notify_staff"; value: { staffId: string; message: string } };
```

### 6.2 Default Automations (Seeded)

| Rule | Trigger | Condition | Action |
|------|---------|-----------|--------|
| Route disputes to Trust team | case_created | type = DISPUTE | assign_team: trust |
| Route chargebacks to Finance | case_created | type = CHARGEBACK | assign_team: finance, set_priority: URGENT |
| Auto-escalate SLA breach | sla_breached | any | escalate |
| Auto-close after 7 days no response | no_response | status = PENDING_USER, 7 days | close: "Auto-closed: no response" |
| High-value order priority boost | case_created | orderTotalCents > 50000 | set_priority: HIGH |
| VIP seller fast track | case_created | sellerStandards.tier = TOP_RATED | set_priority: HIGH, add_tag: vip |

---

## 7) RBAC

### 7.1 New Platform Roles

The helpdesk adds three new platform roles to the RBAC vocabulary:

| Role Name | Display Name | Description |
|-----------|-------------|-------------|
| `HELPDESK_AGENT` | Helpdesk Agent | CS rep — handles cases, replies, resolves. Default screen is /helpdesk. CANNOT access /corp. |
| `HELPDESK_LEAD` | Helpdesk Lead | Senior agent — manages macros, shared views, assigns, views reports. |
| `HELPDESK_MANAGER` | Helpdesk Manager | Manages teams, routing, SLA, automation. Full helpdesk ops. |

These are ADDITIONS to `RBAC_VOCABULARY_LOCK.md`. Existing roles (ADMIN, SUPPORT, FINANCE, MODERATION, DEVELOPER, SRE) are unchanged.

### 7.2 New Permissions

| Permission | Description |
|------------|-------------|
| `helpdesk.cases.view` | View cases in queue |
| `helpdesk.cases.create` | Create cases manually |
| `helpdesk.cases.assign` | Assign/reassign cases |
| `helpdesk.cases.reply` | Send replies to users |
| `helpdesk.cases.note` | Add internal notes |
| `helpdesk.cases.resolve` | Resolve cases |
| `helpdesk.cases.close` | Close cases |
| `helpdesk.cases.escalate` | Escalate cases |
| `helpdesk.cases.merge` | Merge duplicate cases |
| `helpdesk.cases.delete` | Delete cases (ADMIN only) |
| `helpdesk.macros.use` | Use macros in replies |
| `helpdesk.macros.manage` | CRUD macros |
| `helpdesk.teams.manage` | Manage teams and members |
| `helpdesk.routing.manage` | Manage routing rules |
| `helpdesk.sla.manage` | Manage SLA policies |
| `helpdesk.automation.manage` | Manage automation rules |
| `helpdesk.views.manage_shared` | Create/edit shared views |
| `helpdesk.email.manage` | Manage email configuration |
| `helpdesk.reports.view` | View helpdesk analytics |
| `helpdesk.settings.manage` | All helpdesk settings |

### 7.3 Role → Permission Mapping

| Permission | HELPDESK_AGENT | HELPDESK_LEAD | HELPDESK_MANAGER | ADMIN |
|-----------|:-:|:-:|:-:|:-:|
| helpdesk.cases.view | ✅ | ✅ | ✅ | ✅ |
| helpdesk.cases.create | — | ✅ | ✅ | ✅ |
| helpdesk.cases.assign | — | ✅ | ✅ | ✅ |
| helpdesk.cases.reply | ✅ | ✅ | ✅ | ✅ |
| helpdesk.cases.note | ✅ | ✅ | ✅ | ✅ |
| helpdesk.cases.resolve | ✅ | ✅ | ✅ | ✅ |
| helpdesk.cases.close | — | ✅ | ✅ | ✅ |
| helpdesk.cases.escalate | ✅ | ✅ | ✅ | ✅ |
| helpdesk.cases.merge | — | ✅ | ✅ | ✅ |
| helpdesk.cases.delete | — | — | — | ✅ |
| helpdesk.macros.use | ✅ | ✅ | ✅ | ✅ |
| helpdesk.macros.manage | — | ✅ | ✅ | ✅ |
| helpdesk.teams.manage | — | — | ✅ | ✅ |
| helpdesk.routing.manage | — | — | ✅ | ✅ |
| helpdesk.sla.manage | — | — | ✅ | ✅ |
| helpdesk.automation.manage | — | — | ✅ | ✅ |
| helpdesk.views.manage_shared | — | ✅ | ✅ | ✅ |
| helpdesk.email.manage | — | — | — | ✅ |
| helpdesk.reports.view | — | ✅ | ✅ | ✅ |
| helpdesk.settings.manage | — | — | — | ✅ |

### 7.4 Login Routing

| User Roles | Lands at | Can access /corp? | Sees "← Back to Admin"? |
|-----------|----------|-------------------|------------------------|
| HELPDESK_AGENT only | `/helpdesk` | ❌ No | ❌ No |
| HELPDESK_LEAD only | `/helpdesk` | ❌ No | ❌ No |
| HELPDESK_MANAGER only | `/helpdesk` | ❌ No | ❌ No |
| HELPDESK_MANAGER + SUPPORT | `/corp` | ✅ Yes | ✅ Yes |
| ADMIN | `/corp` | ✅ Yes | ✅ Yes |

---

## 8) UI Architecture

### 8.0 Full-Screen App (NOT Inside Corp)

**CRITICAL:** The helpdesk is a SEPARATE full-screen application. It is NOT a section inside the Corp admin layout. When you enter the helpdesk, Corp disappears. The helpdesk owns the entire viewport with its own layout, sidebar, and topbar.

See `TWICELY_HELPDESK_UI_INTEGRATION_ADDENDUM_v2.md` for full details.

### 8.1 Route Tree

```
/helpdesk/                              → Dashboard
/helpdesk/cases                         → Case queue (filterable, saved views)
/helpdesk/cases/[id]                    → Case detail (agent workspace)
/helpdesk/moderation                    → Flagged content queue
/helpdesk/macros                        → Macro management
/helpdesk/teams                         → Team management
/helpdesk/routing                       → Routing rules
/helpdesk/automation                    → Automation rules
/helpdesk/sla                           → SLA policies
/helpdesk/reports                       → Analytics & reports
/helpdesk/settings                      → Email config, general settings
```

All under `apps/web/app/(platform)/helpdesk/` — NOT under `/corp/`.

### 8.1a Corp Sidebar Link

Corp admin sidebar gets a single entry:
```ts
{ key: "helpdesk", label: "Helpdesk", href: "/helpdesk", icon: "Headset" }
```
This EXITS Corp and enters the full-screen helpdesk.

### 8.1b Old Route Redirects
- `/corp/support` → `/helpdesk/cases`
- `/corp/cases` → `/helpdesk/cases?type=DISPUTE`
- `/corp/returns` → `/helpdesk/cases?type=RETURN`
- `/corp/moderation` → `/helpdesk/moderation`

### 8.2 Case Detail Layout (The Agent Workspace)

This is the most important page. It must feel as good as Zendesk.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back    HD-000142    ⚡ URGENT    ● OPEN    👤 Agent Smith       │
│ "Order arrived damaged, requesting full refund"                     │
│ Tags: [damaged] [refund] [high-value]           ⏱ SLA: 2h 14m     │
├────────────────────────────────────┬────────────────────────────────┤
│                                    │                                │
│  TIMELINE (65% width)              │  CONTEXT PANEL (35% width)    │
│                                    │                                │
│  ┌─ 📧 Jan 15 10:23am ──────────┐ │  ┌─ USER ──────────────────┐  │
│  │ Sarah M. (buyer) via email    │ │  │ Sarah Mitchell          │  │
│  │ "I received my order today    │ │  │ buyer since 2024        │  │
│  │  and the vase is cracked..."  │ │  │ 47 orders, 0 disputes   │  │
│  │ 📎 photo_damage.jpg (2)      │ │  │ Trust: 92/100           │  │
│  └───────────────────────────────┘ │  └─────────────────────────┘  │
│                                    │                                │
│  ┌─ 🤖 Jan 15 10:23am ──────────┐ │  ┌─ ORDER #TW-8842 ───────┐  │
│  │ System: Case created from     │ │  │ Status: DELIVERED       │  │
│  │ email. Auto-assigned to       │ │  │ Total: $124.99          │  │
│  │ Support team.                 │ │  │ Items: Crystal Vase (1) │  │
│  └───────────────────────────────┘ │  │ Shipped: Jan 12         │  │
│                                    │  │ Delivered: Jan 15       │  │
│  ┌─ 🔒 Jan 15 10:45am ──────────┐ │  │ Carrier: USPS           │  │
│  │ Internal note by Agent Smith  │ │  │ Tracking: 9400...       │  │
│  │ "Checking with seller for     │ │  └─────────────────────────┘  │
│  │  shipping insurance claim"    │ │                                │
│  └───────────────────────────────┘ │  ┌─ SELLER ────────────────┐  │
│                                    │  │ VintageFinds (seller)    │  │
│  ┌─ 📧 Jan 15 11:02am ──────────┐ │  │ Standards: TOP_RATED    │  │
│  │ Agent Smith → Sarah M.        │ │  │ Trust: 95/100           │  │
│  │ "Hi Sarah, I'm sorry about   │ │  │ Returns: 1.2% rate      │  │
│  │  the damage. I've opened a   │ │  └─────────────────────────┘  │
│  │  return for you. You don't   │ │                                │
│  │  need to ship it back..."    │ │  ┌─ LINKED ────────────────┐  │
│  │ ✅ Delivered                  │ │  │ Return: RET-4421 OPEN   │  │
│  └───────────────────────────────┘ │  │ Dispute: none           │  │
│                                    │  │ Conversations: 1        │  │
│  ┌──────────────────────────────┐  │  └─────────────────────────┘  │
│  │ Reply / Internal Note toggle │  │                                │
│  │                              │  │  ┌─ HISTORY ───────────────┐  │
│  │ [Rich text editor]           │  │  │ HD-000098 (resolved)    │  │
│  │                              │  │  │ HD-000067 (closed)      │  │
│  │ 📎 Attach  🤖 Macro  ✈ Send │  │  │ 3 previous cases        │  │
│  └──────────────────────────────┘  │  └─────────────────────────┘  │
│                                    │                                │
├────────────────────────────────────┤  ┌─ ACTIONS ───────────────┐  │
│ Status: [OPEN ▼] Priority: [▼]    │  │ 🔄 Reassign             │  │
│ Team: [Support ▼] Tags: [+ add]   │  │ ⬆ Escalate              │  │
│                                    │  │ 🔗 Link Order           │  │
│                                    │  │ 🔀 Merge                │  │
│                                    │  │ ✅ Resolve               │  │
│                                    │  └─────────────────────────┘  │
└────────────────────────────────────┴────────────────────────────────┘
```

---

## 9) API Routes

All under `/api/platform/helpdesk/*`. All require RBAC.

### Cases
- `GET /api/platform/helpdesk/cases` — list/search/filter
- `POST /api/platform/helpdesk/cases` — create
- `GET /api/platform/helpdesk/cases/:id` — detail
- `PATCH /api/platform/helpdesk/cases/:id` — update fields
- `POST /api/platform/helpdesk/cases/:id/assign` — assign
- `POST /api/platform/helpdesk/cases/:id/escalate` — escalate
- `POST /api/platform/helpdesk/cases/:id/resolve` — resolve
- `POST /api/platform/helpdesk/cases/:id/close` — close
- `POST /api/platform/helpdesk/cases/:id/reopen` — reopen
- `POST /api/platform/helpdesk/cases/:id/merge` — merge
- `GET /api/platform/helpdesk/cases/:id/context` — full commerce context

### Messages
- `GET /api/platform/helpdesk/cases/:id/messages` — timeline
- `POST /api/platform/helpdesk/cases/:id/messages` — add reply or note
- `POST /api/platform/helpdesk/cases/:id/messages/:msgId/resend` — resend failed email

### Email Inbound
- `POST /api/platform/helpdesk/email/inbound` — SES webhook endpoint (processes incoming email)

### Teams
- `GET/POST /api/platform/helpdesk/teams`
- `GET/PATCH/DELETE /api/platform/helpdesk/teams/:id`
- `POST /api/platform/helpdesk/teams/:id/members`

### Macros
- `GET/POST /api/platform/helpdesk/macros`
- `GET/PATCH/DELETE /api/platform/helpdesk/macros/:id`

### Views
- `GET/POST /api/platform/helpdesk/views`
- `PATCH/DELETE /api/platform/helpdesk/views/:id`

### Routing / SLA / Automation
- CRUD for each under `/api/platform/helpdesk/routing`, `/sla`, `/automation`

### Reports
- `GET /api/platform/helpdesk/reports/overview` — dashboard stats
- `GET /api/platform/helpdesk/reports/agent-performance` — per-agent metrics
- `GET /api/platform/helpdesk/reports/sla-compliance` — SLA tracking
- `GET /api/platform/helpdesk/reports/volume` — case volume over time

### User-Facing (Buyer/Seller)
- `POST /api/helpdesk/submit` — submit case from Twicely UI (no staff auth)
- `GET /api/helpdesk/my-cases` — user's own cases
- `GET /api/helpdesk/my-cases/:id` — user's case detail
- `POST /api/helpdesk/my-cases/:id/reply` — user reply

---

## 10) Migration from Existing Models

### What stays
- `DisputeCase`, `ReturnCase`, `ChargebackCase` — untouched, keep their state machines
- `Conversation`, `Message` — untouched, buyer↔seller messaging remains separate
- `Notification`, `NotificationOutbox` — untouched, notification pipeline stays
- All existing Phase 14, 21, 27, 28, 30, 33 APIs continue to work

### What gets replaced
- `SupportTicket` → `HelpdeskCase` (data migration script)
- `SupportTicketNote` → `CaseMessage` (data migration)
- `SupportMacro` → `HelpdeskMacro` (data migration)

### What gets linked
- When a dispute is opened → auto-create `HelpdeskCase` with `disputeCaseId` link
- When a return is requested → auto-create `HelpdeskCase` with `returnCaseId` link
- When a chargeback arrives → auto-create `HelpdeskCase` with `chargebackCaseId` link
- When a message is flagged → auto-create `HelpdeskCase` with type MODERATION

### Migration script
```
1. For each SupportTicket → create HelpdeskCase preserving all fields
2. For each SupportTicketNote → create CaseMessage
3. For each SupportMacro → create HelpdeskMacro
4. Backfill: for each existing DisputeCase without a linked HelpdeskCase → create one
5. Backfill: for each existing ReturnCase without a linked HelpdeskCase → create one
6. Update foreign key references
7. Verify counts match
8. Keep old tables for 90 days, then drop
```

---

## 11) Health Provider

```
packages/core/health/providers/helpdesk.ts
```

| Check | Pass Condition |
|-------|----------------|
| Cases table accessible | Query succeeds |
| SLA breaches | < 10 breached cases |
| Unassigned cases | < 20 NEW cases older than 30 min |
| Email inbound working | Last inbound email < 24 hours (if volume > 0) |
| Email outbound working | No FAILED delivery in last hour |
| Routing rules exist | At least 1 active rule |
| Default team exists | At least 1 team with isDefault=true |
| SLA policies exist | All 5 priorities have policies |
| Agent availability | At least 1 agent available |

---

## 12) Doctor Checks

1. Create case → verify persisted with caseNumber
2. Assign case → verify assignment + CaseEvent emitted
3. Add reply → verify CaseMessage created + case status updated
4. Add internal note → verify isInternal=true, no email sent
5. SLA computation → verify slaDueAt computed correctly per priority
6. Routing → verify case routes to correct team based on rules
7. Macro → verify macro inserts message + applies status/tag changes
8. Email outbound → verify email sent via SES (mock)
9. Email inbound → verify parsed email creates CaseMessage (mock)
10. Context service → verify returns enriched commerce data
11. Resolve case → verify resolvedAt set + CaseEvent
12. Close case → verify closedAt set + SLA stopped
13. Migration → verify SupportTicket → HelpdeskCase count matches

---

## 13) Completion Criteria

- [ ] All Prisma models created and migrated
- [ ] Case CRUD with full lifecycle (NEW → OPEN → PENDING → RESOLVED → CLOSED)
- [ ] Message timeline with all channels (WEB, EMAIL, INTERNAL, SYSTEM)
- [ ] Email inbound pipeline (SES → S3 → parser → CaseMessage)
- [ ] Email outbound with threading (reply-to headers, In-Reply-To)
- [ ] Routing rules engine with team assignment
- [ ] Auto-assignment (round-robin within team)
- [ ] SLA policies for all priorities with breach detection
- [ ] Automation engine with default rules seeded
- [ ] Macros with variable interpolation and multi-action
- [ ] Context service pulling from 10+ existing models
- [ ] Commerce linking (order, dispute, return, chargeback, conversation)
- [ ] **Full-screen helpdesk layout at /helpdesk/* (own sidebar + topbar, NOT inside Corp)**
- [ ] **"← Back to Admin" button (visible only for users with Corp access)**
- [ ] **Theme toggle in helpdesk topbar (same next-themes provider)**
- [ ] Agent workspace UI (timeline + context panel)
- [ ] Case queue with saved views and filters
- [ ] Dashboard with stats
- [ ] Team management UI
- [ ] **Three new RBAC roles seeded: HELPDESK_AGENT, HELPDESK_LEAD, HELPDESK_MANAGER**
- [ ] All RBAC permissions enforced
- [ ] **Login routing: CS reps → /helpdesk, admins → /corp**
- [ ] **Route protection: HELPDESK_AGENT cannot access /corp**
- [ ] **Corp sidebar shows "Helpdesk" link (exits to /helpdesk)**
- [ ] Health provider registered
- [ ] Doctor passes all 13 checks
- [ ] Data migration from SupportTicket → HelpdeskCase complete
- [ ] Old routes redirect to new helpdesk routes
- [ ] User-facing "Get Help" form creates cases
- [ ] ALL UI components use Tailwind dark: variants (zero inline style colors)
- [ ] TypeScript strict mode: zero errors

---

## 14) What This Does NOT Include (Future)

- ❌ Real-time WebSocket chat (architecture supports it as a channel, not implemented)
- ❌ AI auto-response / suggested replies
- ❌ Phone/voice channel
- ❌ Public knowledge base / FAQ
- ❌ Customer satisfaction surveys (beyond per-case rating)
- ❌ Multi-language support templates

These are Phase 46+ candidates.

---

# END TWICELY HELPDESK V1 CANONICAL
