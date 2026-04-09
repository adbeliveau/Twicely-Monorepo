# TWICELY V2 — Install Phase 45: Helpdesk (Marketplace-Native Support Platform)
**Status:** LOCKED (v1.0)
**Backend-first:** Schema → Service → Email Pipeline → Routing → SLA → Automation → RBAC → Health → UI → Doctor
**Replaces:** Phase 30 Customer Support Console (absorbed + extended)
**Links to:** Phase 14 (Disputes/Returns), Phase 21 (Messaging), Phase 27 (Moderation), Phase 33 (Chargebacks)
**Canonicals (MUST follow):**
- `/rules/TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`
- `/rules/TWICELY_TRUST_SAFETY_CANONICAL.md`
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`
- `/rules/TWICELY_HELPDESK_V1_CANONICAL.md`
- `/rules/TWICELY_HELPDESK_UI_INTEGRATION_ADDENDUM_v2.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_45_HELPDESK.md`
> Prereq: Phase 44 complete and Doctor green.

---

## Global Rules (Apply to this phase)

- **Backend-first**: schema → API → audit/idempotency → health → UI → doctor.
- **Idempotent side effects**: all case actions must be safe to retry.
- **Audit**: every sensitive action writes an immutable AuditEvent.
- **Full-screen app**: The helpdesk is a SEPARATE layout at `/helpdesk/*`, NOT inside the Corp layout.
- **Theme support**: All components use Tailwind `dark:` variants. NO inline styles with hardcoded colors.
- **RBAC**: Three new roles (HELPDESK_AGENT, HELPDESK_LEAD, HELPDESK_MANAGER) plus ADMIN access.

---

## 0) What this phase installs

### Backend
- HelpdeskCase model (universal container replacing SupportTicket)
- CaseMessage model (unified timeline — inbound, outbound, internal, system)
- CaseEvent model (status changes, assignments, escalations)
- HelpdeskTeam model (teams with members, capacity, availability)
- HelpdeskRoutingRule model (auto-routing engine)
- HelpdeskMacro model (canned responses with variable interpolation)
- HelpdeskSlaPolicy model (per-priority SLA targets)
- HelpdeskAutomationRule model (auto-actions on triggers)
- HelpdeskSavedView model (saved filters for case queue)
- HelpdeskEmailConfig model (SES configuration)
- Case lifecycle service (create → assign → reply → resolve → close)
- Context service (pulls commerce data from 10+ existing models)
- Email inbound pipeline (SES → S3 → postal-mime → email-reply-parser → CaseMessage)
- Email outbound (nodemailer via SES with threading headers)
- Routing engine (rule evaluation + auto-assignment)
- SLA calculator (per-priority targets, breach detection, escalation)
- Macro engine (variable interpolation + multi-action)
- Migration service (SupportTicket → HelpdeskCase data migration)
- Case number generator (HD-000001 sequential)

### RBAC
- Three new platform roles: HELPDESK_AGENT, HELPDESK_LEAD, HELPDESK_MANAGER
- 20 new permission keys under `helpdesk.*`
- Role seed script
- Route protection middleware
- Login routing (CS reps → `/helpdesk`, admins → `/corp`)

### UI (Helpdesk — full-screen at `/helpdesk/*`)
- Helpdesk layout (own sidebar, own topbar, theme toggle, back-to-admin button)
- Dashboard (`/helpdesk`) — stat cards, volume chart, team workload, SLA compliance, activity feed
- Case queue (`/helpdesk/cases`) — filterable table, saved views, bulk actions, search
- Agent workspace (`/helpdesk/cases/[id]`) — timeline, compose, context panel
- Moderation queue (`/helpdesk/moderation`)
- Team management (`/helpdesk/teams`)
- Routing rules (`/helpdesk/routing`)
- SLA policies (`/helpdesk/sla`)
- Automation rules (`/helpdesk/automation`)
- Macros management (`/helpdesk/macros`)
- Reports dashboard (`/helpdesk/reports`)
- Settings (`/helpdesk/settings`)

### UI (Corp — sidebar link only)
- Single "Helpdesk" link in Corp sidebar that navigates to `/helpdesk`
- Old `/corp/support`, `/corp/cases`, `/corp/returns`, `/corp/moderation` routes redirect

### UI (Buyer/Seller)
- Buyer: `/help` submit case form, `/account/support` view my cases
- Seller: `/seller/help` submit case form, `/seller/support` view my cases

### Ops
- Health provider: `helpdesk`
- Doctor checks: 13 comprehensive tests

---

## 1) Prisma Schema (Additive)

Add to `prisma/schema.prisma` AFTER the existing models. Do NOT modify or remove existing SupportTicket, DisputeCase, ReturnRequest, CaseNote, or DisputeTimelineEvent models — they remain as-is for backward compatibility.

```prisma
// =============================================================================
// PHASE 45: HELPDESK (Marketplace-Native Support Platform)
// =============================================================================

enum CaseType {
  SUPPORT
  DISPUTE
  RETURN
  CHARGEBACK
  MODERATION
  SYSTEM
  ACCOUNT
  BILLING
}

enum CaseStatus {
  NEW
  OPEN
  PENDING_USER
  PENDING_INTERNAL
  ON_HOLD
  ESCALATED
  RESOLVED
  CLOSED
}

enum CasePriority {
  CRITICAL
  URGENT
  HIGH
  NORMAL
  LOW
}

enum CaseChannel {
  WEB
  EMAIL
  SYSTEM
  INTERNAL
  CHAT
}

enum CaseMessageDirection {
  INBOUND
  OUTBOUND
  INTERNAL
  SYSTEM
}

enum CaseMessageDeliveryStatus {
  PENDING
  SENT
  DELIVERED
  FAILED
  BOUNCED
}

model HelpdeskCase {
  id                  String        @id @default(cuid())
  caseNumber          String        @unique  // HD-000001

  // Type & channel
  type                CaseType
  channel             CaseChannel   @default(WEB)

  // Content
  subject             String
  description         String?

  // Status & priority
  status              CaseStatus    @default(NEW)
  priority            CasePriority  @default(NORMAL)

  // Requester (buyer or seller)
  requesterId         String
  requesterEmail      String?
  requesterType       String        @default("buyer")  // buyer|seller|system

  // Assignment
  assignedTeamId      String?
  assignedTeam        HelpdeskTeam? @relation(fields: [assignedTeamId], references: [id])
  assignedAgentId     String?

  // Commerce links (the killer feature)
  orderId             String?
  listingId           String?
  sellerId            String?
  payoutId            String?
  disputeCaseId       String?
  returnRequestId     String?
  conversationId      String?

  // SLA
  slaFirstResponseDue DateTime?
  slaFirstResponseAt  DateTime?
  slaResolutionDue    DateTime?
  slaResolutionAt     DateTime?

  // Email threading
  emailThreadId       String?       // Message-ID of first email
  emailSubjectLine    String?

  // Metadata
  tags                String[]      @default([])
  category            String?
  source              String?       // e.g., "auto_dispute", "email_inbound"

  // Timestamps
  firstResponseAt     DateTime?
  resolvedAt          DateTime?
  closedAt            DateTime?
  reopenedAt          DateTime?
  lastActivityAt      DateTime      @default(now())
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  // Relations
  messages            CaseMessage[]
  events              CaseEvent[]
  watchers            CaseWatcher[]

  @@index([status, priority, createdAt])
  @@index([assignedAgentId, status])
  @@index([assignedTeamId, status])
  @@index([requesterId, createdAt])
  @@index([orderId])
  @@index([sellerId])
  @@index([disputeCaseId])
  @@index([returnRequestId])
  @@index([slaFirstResponseDue])
  @@index([slaResolutionDue])
  @@index([type, status])
  @@index([channel, status])
  @@index([lastActivityAt])
}

model CaseMessage {
  id                  String        @id @default(cuid())
  caseId              String
  case                HelpdeskCase  @relation(fields: [caseId], references: [id], onDelete: Cascade)

  // Direction
  direction           CaseMessageDirection

  // Author
  authorId            String?       // null for system messages
  authorName          String?
  authorEmail         String?
  authorType          String        @default("agent")  // agent|buyer|seller|system

  // Content
  body                String
  bodyHtml            String?
  isInternal          Boolean       @default(false)

  // Email metadata
  emailMessageId      String?       // RFC 822 Message-ID
  emailInReplyTo      String?
  emailReferences     String[]      @default([])

  // Delivery
  deliveryStatus      CaseMessageDeliveryStatus @default(PENDING)
  deliveredAt         DateTime?
  deliveryError       String?

  // Attachments
  attachments         Json          @default("[]")  // [{name, url, size, mimeType}]

  createdAt           DateTime      @default(now())

  @@index([caseId, createdAt])
  @@index([emailMessageId])
  @@index([direction, caseId])
}

model CaseEvent {
  id              String       @id @default(cuid())
  caseId          String
  case            HelpdeskCase @relation(fields: [caseId], references: [id], onDelete: Cascade)

  eventType       String       // status_changed, assigned, escalated, priority_changed, tag_added, sla_breached, merged, etc.
  description     String

  actorId         String?
  actorName       String?
  actorType       String       @default("system")  // agent|system|automation

  oldValue        String?
  newValue        String?
  metaJson        Json         @default("{}")

  createdAt       DateTime     @default(now())

  @@index([caseId, createdAt])
  @@index([eventType])
}

model CaseWatcher {
  id              String       @id @default(cuid())
  caseId          String
  case            HelpdeskCase @relation(fields: [caseId], references: [id], onDelete: Cascade)

  userId          String
  addedAt         DateTime     @default(now())

  @@unique([caseId, userId])
}

// =============================================================================
// HELPDESK — TEAMS
// =============================================================================

model HelpdeskTeam {
  id              String              @id @default(cuid())
  name            String              @unique
  displayName     String
  description     String?

  isDefault       Boolean             @default(false)  // fallback team
  isActive        Boolean             @default(true)

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  members         HelpdeskTeamMember[]
  cases           HelpdeskCase[]
  routingRules    HelpdeskRoutingRule[]
}

model HelpdeskTeamMember {
  id              String       @id @default(cuid())
  teamId          String
  team            HelpdeskTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)

  userId          String
  role            String       @default("agent")  // agent|lead|manager

  maxConcurrentCases Int       @default(25)
  isAvailable     Boolean      @default(true)

  joinedAt        DateTime     @default(now())

  @@unique([teamId, userId])
  @@index([userId])
  @@index([teamId, isAvailable])
}

// =============================================================================
// HELPDESK — ROUTING
// =============================================================================

model HelpdeskRoutingRule {
  id              String       @id @default(cuid())
  name            String
  description     String?

  // Priority (lower = evaluated first)
  sortOrder       Int          @default(0)
  isActive        Boolean      @default(true)

  // Conditions (JSON — evaluated as AND)
  conditionsJson  Json         @default("[]")
  // [{field: "type", operator: "equals", value: "DISPUTE"}]
  // [{field: "priority", operator: "in", value: ["CRITICAL","URGENT"]}]
  // [{field: "tags", operator: "contains", value: "chargeback"}]

  // Actions
  assignTeamId    String?
  assignTeam      HelpdeskTeam? @relation(fields: [assignTeamId], references: [id])
  setPriority     CasePriority?
  addTags         String[]     @default([])
  setCategory     String?

  createdByStaffId String
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([isActive, sortOrder])
}

// =============================================================================
// HELPDESK — MACROS
// =============================================================================

model HelpdeskMacro {
  id               String   @id @default(cuid())
  title            String
  body             String   // Supports {{variables}}: {{buyer_name}}, {{order_id}}, {{case_number}}
  category         String?  // refund|shipping|general|dispute|return
  
  // Actions (applied when macro is used)
  setStatus        CaseStatus?
  setPriority      CasePriority?
  addTags          String[]  @default([])

  isActive         Boolean  @default(true)
  isShared         Boolean  @default(true)
  createdByStaffId String
  sortOrder        Int      @default(0)

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([category, isActive])
  @@index([isShared, isActive])
}

// =============================================================================
// HELPDESK — SLA POLICIES
// =============================================================================

model HelpdeskSlaPolicy {
  id                    String       @id @default(cuid())
  priority              CasePriority @unique

  // Targets (in minutes)
  firstResponseMinutes  Int
  resolutionMinutes     Int

  // Business hours
  businessHoursOnly     Boolean      @default(true)
  
  // Escalation
  escalateOnBreach      Boolean      @default(true)
  escalateToTeamId      String?

  isActive              Boolean      @default(true)
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
}

// =============================================================================
// HELPDESK — AUTOMATION
// =============================================================================

model HelpdeskAutomationRule {
  id              String   @id @default(cuid())
  name            String
  description     String?

  // Trigger
  triggerEvent    String   // case_created, sla_warning, sla_breached, status_changed, no_response_hours

  // Conditions (JSON)
  conditionsJson  Json     @default("[]")

  // Actions (JSON)
  actionsJson     Json     @default("[]")
  // [{action: "set_priority", value: "URGENT"}]
  // [{action: "assign_team", value: "team_id"}]
  // [{action: "add_tag", value: "auto-escalated"}]
  // [{action: "send_notification", value: {template: "sla_breach"}}]

  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)

  createdByStaffId String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([triggerEvent, isActive])
}

// =============================================================================
// HELPDESK — SAVED VIEWS
// =============================================================================

model HelpdeskSavedView {
  id              String   @id @default(cuid())
  name            String
  
  // Filter criteria (JSON)
  filtersJson     Json     @default("{}")
  // {status: ["OPEN","NEW"], priority: ["CRITICAL","URGENT"], assignee: "me", channel: "EMAIL"}

  sortBy          String   @default("createdAt")
  sortOrder       String   @default("desc")

  isShared        Boolean  @default(false)
  isDefault       Boolean  @default(false)
  createdByUserId String

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([createdByUserId])
  @@index([isShared])
}

// =============================================================================
// HELPDESK — EMAIL CONFIG
// =============================================================================

model HelpdeskEmailConfig {
  id                String   @id @default(cuid())
  
  // Inbound
  inboundDomain     String   @default("support.twicely.com")
  inboundEnabled    Boolean  @default(true)
  
  // Outbound
  fromName          String   @default("Twicely Support")
  fromEmail         String   @default("support@twicely.com")
  replyToPattern    String   @default("case+{{caseId}}@support.twicely.com")
  
  // Auto-reply
  autoReplyEnabled  Boolean  @default(true)
  autoReplyTemplate String   @default("We've received your message and created case {{case_number}}. An agent will respond shortly.")
  
  // SES config
  sesRegion         String   @default("us-east-1")
  s3BucketName      String   @default("twicely-email-inbound")
  
  isActive          Boolean  @default(true)
  updatedByStaffId  String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

Migration:
```bash
npx prisma migrate dev --name helpdesk_phase45
```

---

## 2) RBAC Roles & Permissions

### 2.1 Seed New Roles

Add to the Role seeder (extend existing `prisma/seed.ts`):

```ts
// New helpdesk roles
const helpdeskRoles = [
  {
    name: "HELPDESK_AGENT",
    displayName: "Helpdesk Agent",
    description: "Customer service representative — handles cases, replies, resolves",
    isSystem: true,
    permissions: [
      "helpdesk.cases.view",
      "helpdesk.cases.reply",
      "helpdesk.cases.note",
      "helpdesk.cases.resolve",
      "helpdesk.cases.escalate",
      "helpdesk.macros.use",
    ],
  },
  {
    name: "HELPDESK_LEAD",
    displayName: "Helpdesk Lead",
    description: "Senior agent — manages macros, views, assigns cases, views reports",
    isSystem: true,
    permissions: [
      "helpdesk.cases.view",
      "helpdesk.cases.create",
      "helpdesk.cases.assign",
      "helpdesk.cases.reply",
      "helpdesk.cases.note",
      "helpdesk.cases.resolve",
      "helpdesk.cases.close",
      "helpdesk.cases.escalate",
      "helpdesk.cases.merge",
      "helpdesk.macros.use",
      "helpdesk.macros.manage",
      "helpdesk.views.manage_shared",
      "helpdesk.reports.view",
    ],
  },
  {
    name: "HELPDESK_MANAGER",
    displayName: "Helpdesk Manager",
    description: "Manages teams, routing, SLA, automation — full helpdesk operations",
    isSystem: true,
    permissions: [
      "helpdesk.cases.view",
      "helpdesk.cases.create",
      "helpdesk.cases.assign",
      "helpdesk.cases.reply",
      "helpdesk.cases.note",
      "helpdesk.cases.resolve",
      "helpdesk.cases.close",
      "helpdesk.cases.escalate",
      "helpdesk.cases.merge",
      "helpdesk.macros.use",
      "helpdesk.macros.manage",
      "helpdesk.teams.manage",
      "helpdesk.routing.manage",
      "helpdesk.sla.manage",
      "helpdesk.automation.manage",
      "helpdesk.views.manage_shared",
      "helpdesk.reports.view",
    ],
  },
];

for (const role of helpdeskRoles) {
  await prisma.role.upsert({
    where: { name: role.name },
    update: { permissions: role.permissions },
    create: role,
  });
}

// ADMIN role gets all helpdesk permissions (append to existing ADMIN role)
await prisma.role.update({
  where: { name: "ADMIN" },
  data: {
    permissions: {
      push: [
        "helpdesk.cases.view",
        "helpdesk.cases.create",
        "helpdesk.cases.assign",
        "helpdesk.cases.reply",
        "helpdesk.cases.note",
        "helpdesk.cases.resolve",
        "helpdesk.cases.close",
        "helpdesk.cases.escalate",
        "helpdesk.cases.merge",
        "helpdesk.cases.delete",
        "helpdesk.macros.use",
        "helpdesk.macros.manage",
        "helpdesk.teams.manage",
        "helpdesk.routing.manage",
        "helpdesk.sla.manage",
        "helpdesk.automation.manage",
        "helpdesk.views.manage_shared",
        "helpdesk.email.manage",
        "helpdesk.reports.view",
        "helpdesk.settings.manage",
      ],
    },
  },
});
```

### 2.2 Login Routing

Create `packages/core/rbac/getDefaultLandingPage.ts`:

```ts
const CORP_ROLES = ["ADMIN", "SUPPORT", "FINANCE", "MODERATION", "DEVELOPER", "SRE"];
const HELPDESK_ROLES = ["HELPDESK_AGENT", "HELPDESK_LEAD", "HELPDESK_MANAGER"];

export function getDefaultLandingPage(roleNames: string[]): string {
  const hasCorpAccess = roleNames.some(r => CORP_ROLES.includes(r));
  const hasHelpdeskRole = roleNames.some(r => HELPDESK_ROLES.includes(r));

  // Pure helpdesk roles → land in helpdesk
  if (hasHelpdeskRole && !hasCorpAccess) return "/helpdesk";

  // Corp roles → land in corp (can navigate to helpdesk from sidebar)
  if (hasCorpAccess) return "/corp";

  // Seller
  if (roleNames.includes("SELLER")) return "/seller";

  // Default → home
  return "/";
}

export function canAccessCorp(roleNames: string[]): boolean {
  return roleNames.some(r => CORP_ROLES.includes(r));
}

export function canAccessHelpdesk(roleNames: string[]): boolean {
  return roleNames.some(r => [...HELPDESK_ROLES, "ADMIN"].includes(r));
}
```

### 2.3 Middleware Route Protection

Add to `middleware.ts`:

```ts
// Helpdesk routes — require helpdesk role or ADMIN
if (pathname.startsWith("/helpdesk")) {
  const helpdeskAllowed = ["HELPDESK_AGENT", "HELPDESK_LEAD", "HELPDESK_MANAGER", "ADMIN"];
  if (!session.roles.some(r => helpdeskAllowed.includes(r))) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }
}

// Corp routes — helpdesk-only agents CANNOT access
if (pathname.startsWith("/corp")) {
  const corpAllowed = ["ADMIN", "SUPPORT", "FINANCE", "MODERATION", "DEVELOPER", "SRE"];
  if (!session.roles.some(r => corpAllowed.includes(r))) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }
}
```

---

## 3) Case Number Generator

Create `packages/core/helpdesk/caseNumber.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function generateCaseNumber(): Promise<string> {
  // Atomic counter using a sequence or max+1
  const lastCase = await prisma.helpdeskCase.findFirst({
    orderBy: { createdAt: "desc" },
    select: { caseNumber: true },
  });

  let nextNum = 1;
  if (lastCase?.caseNumber) {
    const match = lastCase.caseNumber.match(/HD-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  return `HD-${String(nextNum).padStart(6, "0")}`;
}
```

---

## 4) SLA Calculator

Create `packages/core/helpdesk/sla.ts`:

```ts
import { CasePriority } from "@prisma/client";

// Default SLA targets (in minutes)
const DEFAULT_SLA: Record<CasePriority, { firstResponse: number; resolution: number; businessHoursOnly: boolean }> = {
  CRITICAL: { firstResponse: 30, resolution: 240, businessHoursOnly: false },       // 30 min / 4 hr (24/7)
  URGENT:   { firstResponse: 60, resolution: 480, businessHoursOnly: false },       // 1 hr / 8 hr (24/7)
  HIGH:     { firstResponse: 240, resolution: 1440, businessHoursOnly: true },      // 4 hr / 24 hr (biz hours)
  NORMAL:   { firstResponse: 480, resolution: 2880, businessHoursOnly: true },      // 8 hr / 48 hr (biz hours)
  LOW:      { firstResponse: 1440, resolution: 4320, businessHoursOnly: true },     // 24 hr / 72 hr (biz hours)
};

export function computeSlaTargets(priority: CasePriority, createdAt: Date = new Date()) {
  const sla = DEFAULT_SLA[priority];
  return {
    firstResponseDue: new Date(createdAt.getTime() + sla.firstResponse * 60 * 1000),
    resolutionDue: new Date(createdAt.getTime() + sla.resolution * 60 * 1000),
  };
}

export function isSlaBreached(dueAt: Date | null): boolean {
  if (!dueAt) return false;
  return new Date() > dueAt;
}

export function getSlaStatus(dueAt: Date | null): "ok" | "warning" | "breached" {
  if (!dueAt) return "ok";
  const now = new Date();
  if (now > dueAt) return "breached";
  const remaining = dueAt.getTime() - now.getTime();
  const totalWindow = dueAt.getTime() - (dueAt.getTime() - 60 * 60 * 1000); // rough
  if (remaining < 30 * 60 * 1000) return "warning"; // < 30 min left
  return "ok";
}
```

---

## 5) Core Helpdesk Service

Create `packages/core/helpdesk/service.ts`:

```ts
import { PrismaClient, CaseType, CaseChannel, CasePriority, CaseStatus } from "@prisma/client";
import { generateCaseNumber } from "./caseNumber";
import { computeSlaTargets } from "./sla";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

// ─── CREATE CASE ───
export async function createCase(args: {
  type: CaseType;
  channel: CaseChannel;
  subject: string;
  description?: string;
  priority?: CasePriority;
  requesterId: string;
  requesterEmail?: string;
  requesterType?: string;
  orderId?: string;
  listingId?: string;
  sellerId?: string;
  disputeCaseId?: string;
  returnRequestId?: string;
  conversationId?: string;
  tags?: string[];
  staffActorId?: string;
}) {
  const priority = args.priority ?? "NORMAL";
  const caseNumber = await generateCaseNumber();
  const sla = computeSlaTargets(priority);

  const hdCase = await prisma.helpdeskCase.create({
    data: {
      caseNumber,
      type: args.type,
      channel: args.channel,
      subject: args.subject,
      description: args.description,
      priority,
      requesterId: args.requesterId,
      requesterEmail: args.requesterEmail,
      requesterType: args.requesterType ?? "buyer",
      orderId: args.orderId,
      listingId: args.listingId,
      sellerId: args.sellerId,
      disputeCaseId: args.disputeCaseId,
      returnRequestId: args.returnRequestId,
      conversationId: args.conversationId,
      tags: args.tags ?? [],
      slaFirstResponseDue: sla.firstResponseDue,
      slaResolutionDue: sla.resolutionDue,
    },
  });

  // Create system event
  await prisma.caseEvent.create({
    data: {
      caseId: hdCase.id,
      eventType: "case_created",
      description: `Case ${caseNumber} created via ${args.channel}`,
      actorId: args.staffActorId,
      actorType: args.staffActorId ? "agent" : "system",
    },
  });

  // Audit
  await emitAuditEvent({
    actorUserId: args.staffActorId ?? args.requesterId,
    action: "helpdesk.case.create",
    entityType: "HelpdeskCase",
    entityId: hdCase.id,
    meta: { caseNumber, type: args.type, channel: args.channel, priority },
  });

  return hdCase;
}

// ─── ASSIGN CASE ───
export async function assignCase(args: {
  caseId: string;
  assignedAgentId?: string;
  assignedTeamId?: string;
  staffActorId: string;
}) {
  const hdCase = await prisma.helpdeskCase.update({
    where: { id: args.caseId },
    data: {
      assignedAgentId: args.assignedAgentId,
      assignedTeamId: args.assignedTeamId,
      status: args.assignedAgentId ? "OPEN" : undefined,
    },
  });

  await prisma.caseEvent.create({
    data: {
      caseId: args.caseId,
      eventType: "assigned",
      description: `Case assigned to ${args.assignedAgentId ?? args.assignedTeamId}`,
      actorId: args.staffActorId,
      actorType: "agent",
      newValue: args.assignedAgentId ?? args.assignedTeamId,
    },
  });

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "helpdesk.case.assign",
    entityType: "HelpdeskCase",
    entityId: args.caseId,
    meta: { assignedAgentId: args.assignedAgentId, assignedTeamId: args.assignedTeamId },
  });

  return hdCase;
}

// ─── ADD MESSAGE (Reply / Internal Note) ───
export async function addCaseMessage(args: {
  caseId: string;
  direction: "OUTBOUND" | "INTERNAL";
  authorId: string;
  authorName: string;
  authorEmail?: string;
  body: string;
  bodyHtml?: string;
  isInternal?: boolean;
  attachments?: any[];
}) {
  const message = await prisma.caseMessage.create({
    data: {
      caseId: args.caseId,
      direction: args.direction,
      authorId: args.authorId,
      authorName: args.authorName,
      authorEmail: args.authorEmail,
      authorType: "agent",
      body: args.body,
      bodyHtml: args.bodyHtml,
      isInternal: args.isInternal ?? (args.direction === "INTERNAL"),
      attachments: args.attachments ?? [],
    },
  });

  // Update case status and last activity
  const updateData: any = { lastActivityAt: new Date() };

  // If this is the first outbound reply, record first response time
  if (args.direction === "OUTBOUND") {
    const hdCase = await prisma.helpdeskCase.findUnique({ where: { id: args.caseId } });
    if (hdCase && !hdCase.firstResponseAt) {
      updateData.firstResponseAt = new Date();
      updateData.slaFirstResponseAt = new Date();
    }
    if (hdCase?.status === "NEW") {
      updateData.status = "OPEN";
    }
  }

  await prisma.helpdeskCase.update({
    where: { id: args.caseId },
    data: updateData,
  });

  await emitAuditEvent({
    actorUserId: args.authorId,
    action: args.isInternal ? "helpdesk.case.note.add" : "helpdesk.case.reply",
    entityType: "CaseMessage",
    entityId: message.id,
    meta: { caseId: args.caseId, direction: args.direction },
  });

  return message;
}

// ─── RESOLVE CASE ───
export async function resolveCase(args: {
  caseId: string;
  staffActorId: string;
  resolution?: string;
}) {
  const hdCase = await prisma.helpdeskCase.update({
    where: { id: args.caseId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      slaResolutionAt: new Date(),
      lastActivityAt: new Date(),
    },
  });

  await prisma.caseEvent.create({
    data: {
      caseId: args.caseId,
      eventType: "status_changed",
      description: `Case resolved${args.resolution ? `: ${args.resolution}` : ""}`,
      actorId: args.staffActorId,
      actorType: "agent",
      oldValue: "OPEN",
      newValue: "RESOLVED",
    },
  });

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "helpdesk.case.resolve",
    entityType: "HelpdeskCase",
    entityId: args.caseId,
    meta: { resolution: args.resolution },
  });

  return hdCase;
}

// ─── CLOSE CASE ───
export async function closeCase(args: {
  caseId: string;
  staffActorId: string;
}) {
  const hdCase = await prisma.helpdeskCase.update({
    where: { id: args.caseId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      lastActivityAt: new Date(),
    },
  });

  await prisma.caseEvent.create({
    data: {
      caseId: args.caseId,
      eventType: "status_changed",
      description: "Case closed",
      actorId: args.staffActorId,
      actorType: "agent",
      oldValue: "RESOLVED",
      newValue: "CLOSED",
    },
  });

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "helpdesk.case.close",
    entityType: "HelpdeskCase",
    entityId: args.caseId,
  });

  return hdCase;
}

// ─── ESCALATE CASE ───
export async function escalateCase(args: {
  caseId: string;
  staffActorId: string;
  reason?: string;
  escalateToTeamId?: string;
}) {
  const hdCase = await prisma.helpdeskCase.update({
    where: { id: args.caseId },
    data: {
      status: "ESCALATED",
      assignedTeamId: args.escalateToTeamId ?? undefined,
      lastActivityAt: new Date(),
    },
  });

  await prisma.caseEvent.create({
    data: {
      caseId: args.caseId,
      eventType: "escalated",
      description: `Case escalated${args.reason ? `: ${args.reason}` : ""}`,
      actorId: args.staffActorId,
      actorType: "agent",
      metaJson: { reason: args.reason, escalateToTeamId: args.escalateToTeamId },
    },
  });

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "helpdesk.case.escalate",
    entityType: "HelpdeskCase",
    entityId: args.caseId,
    meta: { reason: args.reason },
  });

  return hdCase;
}
```

---

## 6) Context Service (Commerce Enrichment)

Create `packages/core/helpdesk/contextService.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getCaseContext(caseId: string) {
  const hdCase = await prisma.helpdeskCase.findUnique({
    where: { id: caseId },
  });

  if (!hdCase) return null;

  const [requester, order, seller, dispute, returnReq, previousCases] = await Promise.all([
    // Requester profile
    prisma.user.findUnique({
      where: { id: hdCase.requesterId },
      select: {
        id: true, displayName: true, email: true, avatarUrl: true,
        createdAt: true, isSeller: true,
      },
    }),

    // Linked order
    hdCase.orderId ? prisma.order.findUnique({
      where: { id: hdCase.orderId },
      select: {
        id: true, orderNumber: true, status: true, totalCents: true,
        createdAt: true, buyerId: true, sellerId: true,
        items: { select: { id: true, title: true, priceCents: true, quantity: true } },
        shipments: { select: { id: true, carrier: true, trackingNumber: true, status: true, deliveredAt: true } },
      },
    }) : null,

    // Seller profile (if order has seller)
    hdCase.sellerId ? prisma.user.findUnique({
      where: { id: hdCase.sellerId },
      select: {
        id: true, displayName: true, email: true,
        sellerProfile: { select: { status: true } },
      },
    }) : null,

    // Linked dispute
    hdCase.disputeCaseId ? prisma.disputeCase.findUnique({
      where: { id: hdCase.disputeCaseId },
      select: { id: true, status: true, type: true, reason: true, createdAt: true },
    }) : null,

    // Linked return
    hdCase.returnRequestId ? prisma.returnRequest.findUnique({
      where: { id: hdCase.returnRequestId },
      select: { id: true, status: true, reason: true, refundAmountCents: true, createdAt: true },
    }) : null,

    // Previous cases from same requester
    prisma.helpdeskCase.findMany({
      where: { requesterId: hdCase.requesterId, id: { not: caseId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, caseNumber: true, subject: true, status: true, createdAt: true },
    }),
  ]);

  // Get requester stats
  const [orderCount, disputeCount] = await Promise.all([
    prisma.order.count({ where: { buyerId: hdCase.requesterId } }),
    prisma.disputeCase.count({ where: { buyerId: hdCase.requesterId } }),
  ]);

  // Get seller standards if seller exists
  let sellerStandards = null;
  if (hdCase.sellerId) {
    sellerStandards = await prisma.sellerStandards.findUnique({
      where: { userId: hdCase.sellerId },
      select: { currentBand: true, overallScore: true, returnRate: true },
    });
  }

  return {
    case: hdCase,
    requester: {
      ...requester,
      stats: { orderCount, disputeCount },
    },
    order,
    seller: seller ? {
      ...seller,
      standards: sellerStandards,
    } : null,
    linkedDispute: dispute,
    linkedReturn: returnReq,
    previousCases,
  };
}
```

---

## 7) Routing Engine

Create `packages/core/helpdesk/routing.ts`:

```ts
import { PrismaClient, HelpdeskCase } from "@prisma/client";

const prisma = new PrismaClient();

export async function evaluateRoutingRules(hdCase: HelpdeskCase) {
  const rules = await prisma.helpdeskRoutingRule.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { assignTeam: true },
  });

  for (const rule of rules) {
    const conditions = rule.conditionsJson as any[];
    if (matchesAllConditions(hdCase, conditions)) {
      return {
        assignTeamId: rule.assignTeamId,
        setPriority: rule.setPriority,
        addTags: rule.addTags,
        setCategory: rule.setCategory,
      };
    }
  }

  // Fallback: assign to default team
  const defaultTeam = await prisma.helpdeskTeam.findFirst({ where: { isDefault: true } });
  return { assignTeamId: defaultTeam?.id ?? null, setPriority: null, addTags: [], setCategory: null };
}

function matchesAllConditions(hdCase: HelpdeskCase, conditions: any[]): boolean {
  if (!conditions || conditions.length === 0) return false;

  return conditions.every(cond => {
    const value = (hdCase as any)[cond.field];
    switch (cond.operator) {
      case "equals": return value === cond.value;
      case "not_equals": return value !== cond.value;
      case "in": return Array.isArray(cond.value) && cond.value.includes(value);
      case "contains": return Array.isArray(value) && value.includes(cond.value);
      case "gt": return typeof value === "number" && value > cond.value;
      case "lt": return typeof value === "number" && value < cond.value;
      default: return false;
    }
  });
}

// Auto-assign to least-loaded agent on team
export async function autoAssignToAgent(teamId: string): Promise<string | null> {
  const members = await prisma.helpdeskTeamMember.findMany({
    where: { teamId, isAvailable: true },
  });

  if (members.length === 0) return null;

  // Get case counts per agent
  const agentCounts = await Promise.all(
    members.map(async (m) => ({
      userId: m.userId,
      maxCases: m.maxConcurrentCases,
      currentCases: await prisma.helpdeskCase.count({
        where: { assignedAgentId: m.userId, status: { in: ["NEW", "OPEN", "PENDING_USER", "PENDING_INTERNAL", "ESCALATED"] } },
      }),
    }))
  );

  // Find agent with most capacity
  const available = agentCounts
    .filter(a => a.currentCases < a.maxCases)
    .sort((a, b) => (a.currentCases / a.maxCases) - (b.currentCases / b.maxCases));

  return available[0]?.userId ?? null;
}
```

---

## 8) Migration Service (SupportTicket → HelpdeskCase)

Create `packages/core/helpdesk/migration.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { generateCaseNumber } from "./caseNumber";

const prisma = new PrismaClient();

export async function migrateSupportTickets(): Promise<{ migrated: number; errors: number }> {
  const tickets = await prisma.supportTicket.findMany({
    include: { notes: true },
  });

  let migrated = 0;
  let errors = 0;

  for (const ticket of tickets) {
    try {
      const caseNumber = await generateCaseNumber();

      const hdCase = await prisma.helpdeskCase.create({
        data: {
          caseNumber,
          type: "SUPPORT",
          channel: ticket.channel === "email" ? "EMAIL" : ticket.channel === "system" ? "SYSTEM" : "WEB",
          subject: ticket.subject,
          status: mapTicketStatus(ticket.status),
          priority: mapTicketPriority(ticket.priority),
          requesterId: ticket.actorUserId ?? "SYSTEM",
          requesterType: ticket.actorType,
          sellerId: ticket.sellerId,
          orderId: ticket.orderId,
          slaFirstResponseDue: ticket.slaDueAt,
          resolvedAt: ticket.resolvedAt,
          closedAt: ticket.closedAt,
          createdAt: ticket.createdAt,
        },
      });

      // Migrate notes → CaseMessages
      for (const note of ticket.notes) {
        await prisma.caseMessage.create({
          data: {
            caseId: hdCase.id,
            direction: note.kind === "internal" ? "INTERNAL" : "OUTBOUND",
            authorId: note.authorStaffId,
            authorType: "agent",
            body: note.body,
            isInternal: note.kind === "internal",
            createdAt: note.createdAt,
          },
        });
      }

      migrated++;
    } catch (err) {
      errors++;
      console.error(`Failed to migrate ticket ${ticket.id}:`, err);
    }
  }

  return { migrated, errors };
}

function mapTicketStatus(status: string): "NEW" | "OPEN" | "PENDING_USER" | "RESOLVED" | "CLOSED" {
  switch (status) {
    case "OPEN": return "NEW";
    case "ASSIGNED": return "OPEN";
    case "WAITING": return "PENDING_USER";
    case "RESOLVED": return "RESOLVED";
    case "CLOSED": return "CLOSED";
    default: return "NEW";
  }
}

function mapTicketPriority(priority: string): "CRITICAL" | "URGENT" | "HIGH" | "NORMAL" | "LOW" {
  switch (priority) {
    case "URGENT": return "URGENT";
    case "HIGH": return "HIGH";
    case "NORMAL": return "NORMAL";
    case "LOW": return "LOW";
    default: return "NORMAL";
  }
}
```

---

## 9) Corp API Routes

All under `/api/platform/helpdesk/*`. RBAC enforced on every route.

### 9.1 Cases

```
GET    /api/platform/helpdesk/cases                   → List cases (filterable, paginated)
POST   /api/platform/helpdesk/cases                   → Create case
GET    /api/platform/helpdesk/cases/:id                → Get case detail
PATCH  /api/platform/helpdesk/cases/:id                → Update case (status, priority, tags)
POST   /api/platform/helpdesk/cases/:id/assign         → Assign case
POST   /api/platform/helpdesk/cases/:id/escalate       → Escalate case
POST   /api/platform/helpdesk/cases/:id/resolve        → Resolve case
POST   /api/platform/helpdesk/cases/:id/close          → Close case
POST   /api/platform/helpdesk/cases/:id/reopen         → Reopen case
POST   /api/platform/helpdesk/cases/:id/merge          → Merge cases
```

### 9.2 Messages

```
GET    /api/platform/helpdesk/cases/:id/messages       → Get timeline
POST   /api/platform/helpdesk/cases/:id/messages       → Add reply or internal note
```

### 9.3 Context

```
GET    /api/platform/helpdesk/cases/:id/context        → Get commerce context
```

### 9.4 Teams

```
GET    /api/platform/helpdesk/teams                    → List teams
POST   /api/platform/helpdesk/teams                    → Create team
PATCH  /api/platform/helpdesk/teams/:id                → Update team
POST   /api/platform/helpdesk/teams/:id/members        → Add member
DELETE /api/platform/helpdesk/teams/:id/members/:userId → Remove member
```

### 9.5 Macros

```
GET    /api/platform/helpdesk/macros                   → List macros
POST   /api/platform/helpdesk/macros                   → Create macro
PATCH  /api/platform/helpdesk/macros/:id               → Update macro
DELETE /api/platform/helpdesk/macros/:id                → Delete macro
```

### 9.6 Routing, SLA, Automation, Views — same CRUD pattern

### 9.7 Stats

```
GET    /api/platform/helpdesk/stats/overview           → Dashboard stats
GET    /api/platform/helpdesk/stats/agent-performance  → Agent metrics
GET    /api/platform/helpdesk/stats/sla-compliance     → SLA metrics
```

### 9.8 User-Facing (NOT platform routes)

```
POST   /api/helpdesk/submit                            → Buyer/seller submits a case
GET    /api/helpdesk/my-cases                           → User's own cases
GET    /api/helpdesk/my-cases/:id                       → Case detail (public messages only)
POST   /api/helpdesk/my-cases/:id/reply                 → User replies to case
```

---

## 10) UI: Helpdesk Layout (Full-Screen App)

### 10.1 Layout Structure

Create `apps/web/app/(platform)/helpdesk/layout.tsx`:

This is a COMPLETELY SEPARATE layout from Corp. It has:
- Its own sidebar (helpdesk navigation)
- Its own topbar (back-to-admin button, helpdesk title, notifications, theme toggle, agent menu)
- NO Corp sidebar visible

```tsx
import { HelpdeskSidebar } from "./components/HelpdeskSidebar";
import { HelpdeskTopbar } from "./components/HelpdeskTopbar";
import { requireHelpdeskAuth } from "@/lib/helpdeskAuth";

export default async function HelpdeskLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireHelpdeskAuth();

  return (
    <div className="flex h-screen bg-background">
      <HelpdeskSidebar
        permissions={ctx.permissions}
        agentName={ctx.displayName}
        agentId={ctx.actorUserId}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <HelpdeskTopbar canAccessCorp={ctx.canAccessCorp} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 10.2 Page Structure

```
apps/web/app/(platform)/helpdesk/
├── layout.tsx                          # Helpdesk layout (sidebar + topbar)
├── page.tsx                            # Dashboard
├── cases/
│   ├── page.tsx                        # Case queue (filterable table)
│   └── [id]/
│       └── page.tsx                    # Agent workspace (case detail)
├── moderation/
│   └── page.tsx                        # Moderation queue
├── macros/
│   └── page.tsx                        # Macros management
├── teams/
│   └── page.tsx                        # Teams management
├── routing/
│   └── page.tsx                        # Routing rules
├── sla/
│   └── page.tsx                        # SLA policies
├── automation/
│   └── page.tsx                        # Automation rules
├── reports/
│   └── page.tsx                        # Reports dashboard
├── settings/
│   └── page.tsx                        # Email config, general settings
└── components/
    ├── HelpdeskSidebar.tsx
    ├── HelpdeskTopbar.tsx
    ├── CaseQueue.tsx                   # Filterable case table
    ├── CaseTimeline.tsx                # Message timeline
    ├── CaseComposer.tsx                # Reply / internal note composer
    ├── CaseContextPanel.tsx            # Commerce context panel
    ├── CaseHeader.tsx                  # Case header with status/priority
    ├── DashboardStats.tsx              # Stat cards
    ├── DashboardChart.tsx              # Volume chart
    ├── TeamWorkload.tsx                # Team capacity visualization
    ├── SlaComplianceRings.tsx          # SLA donut charts
    └── ActivityFeed.tsx                # Recent activity list
```

### 10.3 Corp Sidebar — Add Helpdesk Link

In `apps/web/app/(platform)/corp/navigation.ts`, add:

```ts
{ key: "helpdesk", label: "Helpdesk", href: "/helpdesk", icon: "Headset", section: "main", sortOrder: 50, requires: "helpdesk.cases.view" },
```

This is a LINK OUT to `/helpdesk` — not a sub-page of Corp.

### 10.4 Old Route Redirects

In `middleware.ts`, add redirects:

```ts
const HELPDESK_REDIRECTS: Record<string, string> = {
  "/corp/support": "/helpdesk/cases",
  "/corp/cases": "/helpdesk/cases?type=DISPUTE",
  "/corp/returns": "/helpdesk/cases?type=RETURN",
  "/corp/moderation": "/helpdesk/moderation",
};

if (HELPDESK_REDIRECTS[pathname]) {
  return NextResponse.redirect(new URL(HELPDESK_REDIRECTS[pathname], req.url));
}
```

---

## 11) Seed Data

Create `packages/core/helpdesk/seed.ts`:

```ts
export async function seedHelpdesk(prisma: PrismaClient) {
  // Default team
  await prisma.helpdeskTeam.upsert({
    where: { name: "support" },
    update: {},
    create: {
      name: "support",
      displayName: "General Support",
      description: "Default support team",
      isDefault: true,
    },
  });

  await prisma.helpdeskTeam.upsert({
    where: { name: "trust" },
    update: {},
    create: { name: "trust", displayName: "Trust & Safety", description: "Disputes, fraud, policy violations" },
  });

  await prisma.helpdeskTeam.upsert({
    where: { name: "finance" },
    update: {},
    create: { name: "finance", displayName: "Finance", description: "Chargebacks, payouts, billing" },
  });

  // SLA policies
  const slaPolicies = [
    { priority: "CRITICAL", firstResponseMinutes: 30, resolutionMinutes: 240, businessHoursOnly: false },
    { priority: "URGENT", firstResponseMinutes: 60, resolutionMinutes: 480, businessHoursOnly: false },
    { priority: "HIGH", firstResponseMinutes: 240, resolutionMinutes: 1440, businessHoursOnly: true },
    { priority: "NORMAL", firstResponseMinutes: 480, resolutionMinutes: 2880, businessHoursOnly: true },
    { priority: "LOW", firstResponseMinutes: 1440, resolutionMinutes: 4320, businessHoursOnly: true },
  ];

  for (const sla of slaPolicies) {
    await prisma.helpdeskSlaPolicy.upsert({
      where: { priority: sla.priority as any },
      update: sla,
      create: { ...sla, priority: sla.priority as any },
    });
  }

  // Default routing rules
  await prisma.helpdeskRoutingRule.createMany({
    skipDuplicates: true,
    data: [
      {
        name: "Disputes → Trust",
        sortOrder: 10,
        conditionsJson: [{ field: "type", operator: "equals", value: "DISPUTE" }],
        assignTeamId: (await prisma.helpdeskTeam.findUnique({ where: { name: "trust" } }))?.id,
        createdByStaffId: "SEED",
      },
      {
        name: "Chargebacks → Finance (URGENT)",
        sortOrder: 20,
        conditionsJson: [{ field: "type", operator: "equals", value: "CHARGEBACK" }],
        assignTeamId: (await prisma.helpdeskTeam.findUnique({ where: { name: "finance" } }))?.id,
        setPriority: "URGENT",
        addTags: ["chargeback"],
        createdByStaffId: "SEED",
      },
    ],
  });

  // Default macros
  const macros = [
    { title: "Approve Full Refund", body: "I've reviewed your case and approved a full refund of {{order_total}}. The amount will be returned to your original payment method within 3-5 business days.", category: "refund", setStatus: "RESOLVED" as any },
    { title: "Request More Info", body: "Could you please provide additional details or photos? This will help us process your case faster.", category: "general" },
    { title: "Shipping Delay", body: "I understand how frustrating shipping delays can be. I've contacted the seller and requested an update. I'll follow up as soon as I hear back.", category: "shipping" },
    { title: "Escalate to Seller", body: "I've escalated this to the seller for their response. They have 48 hours to respond. If they don't, we'll resolve this in your favor automatically.", category: "dispute" },
    { title: "Close — Resolved", body: "I'm glad we could resolve this for you! If you need anything else in the future, don't hesitate to reach out.", category: "general", setStatus: "RESOLVED" as any },
  ];

  for (const macro of macros) {
    await prisma.helpdeskMacro.create({
      data: { ...macro, createdByStaffId: "SEED", isShared: true },
    });
  }

  // Email config
  await prisma.helpdeskEmailConfig.create({
    data: {},
  }).catch(() => {}); // Skip if exists
}
```

---

## 12) Health Provider

Create `packages/core/health/providers/helpdesk.ts`:

```ts
import { HealthCheckResult } from "../types";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function checkHelpdesk(): Promise<HealthCheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Cases table accessible
  try { await prisma.helpdeskCase.count(); } catch { errors.push("HelpdeskCase table not accessible"); }

  // 2. SLA breaches
  const breached = await prisma.helpdeskCase.count({
    where: {
      status: { in: ["NEW", "OPEN", "ESCALATED"] },
      slaFirstResponseDue: { lt: new Date() },
      firstResponseAt: null,
    },
  });
  if (breached > 10) errors.push(`${breached} cases with breached SLA`);
  else if (breached > 0) warnings.push(`${breached} cases with breached SLA`);

  // 3. Unassigned cases
  const unassigned = await prisma.helpdeskCase.count({
    where: { status: "NEW", assignedAgentId: null, createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
  });
  if (unassigned > 20) errors.push(`${unassigned} unassigned cases older than 30min`);
  else if (unassigned > 5) warnings.push(`${unassigned} unassigned cases`);

  // 4. Default team exists
  const defaultTeam = await prisma.helpdeskTeam.findFirst({ where: { isDefault: true } });
  if (!defaultTeam) errors.push("No default helpdesk team");

  // 5. SLA policies exist
  const slaPolicies = await prisma.helpdeskSlaPolicy.count({ where: { isActive: true } });
  if (slaPolicies < 5) warnings.push(`Only ${slaPolicies}/5 SLA policies configured`);

  // 6. At least one routing rule
  const routingRules = await prisma.helpdeskRoutingRule.count({ where: { isActive: true } });
  if (routingRules === 0) warnings.push("No routing rules configured");

  return {
    provider: "helpdesk",
    status: errors.length > 0 ? "degraded" : warnings.length > 0 ? "degraded" : "healthy",
    errors: [...errors, ...warnings],
    checkedAt: new Date().toISOString(),
  };
}
```

---

## 13) Doctor Checks

```ts
async function checkPhase45(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];

  // 1. Create case → verify persisted with case number
  const hdCase = await createCase({
    type: "SUPPORT", channel: "WEB", subject: "Doctor Test",
    requesterId: "doctor_test_user", priority: "NORMAL",
  });
  checks.push({
    phase: 45, name: "helpdesk.case_create",
    status: hdCase?.caseNumber?.startsWith("HD-") ? "PASS" : "FAIL",
    details: hdCase?.caseNumber,
  });

  // 2. Assign case → verify assignment + CaseEvent
  await assignCase({ caseId: hdCase.id, assignedAgentId: "doctor_agent", staffActorId: "doctor_staff" });
  const assigned = await prisma.helpdeskCase.findUnique({ where: { id: hdCase.id } });
  const assignEvent = await prisma.caseEvent.findFirst({ where: { caseId: hdCase.id, eventType: "assigned" } });
  checks.push({
    phase: 45, name: "helpdesk.case_assign",
    status: assigned?.assignedAgentId === "doctor_agent" && assignEvent ? "PASS" : "FAIL",
  });

  // 3. Add reply → verify CaseMessage created
  const msg = await addCaseMessage({
    caseId: hdCase.id, direction: "OUTBOUND", authorId: "doctor_agent",
    authorName: "Doctor Agent", body: "Test reply",
  });
  checks.push({ phase: 45, name: "helpdesk.case_reply", status: msg?.id ? "PASS" : "FAIL" });

  // 4. Add internal note → verify isInternal=true
  const note = await addCaseMessage({
    caseId: hdCase.id, direction: "INTERNAL", authorId: "doctor_agent",
    authorName: "Doctor Agent", body: "Internal test", isInternal: true,
  });
  checks.push({ phase: 45, name: "helpdesk.internal_note", status: note?.isInternal === true ? "PASS" : "FAIL" });

  // 5. SLA computation → verify slaFirstResponseDue set
  checks.push({
    phase: 45, name: "helpdesk.sla_computation",
    status: hdCase.slaFirstResponseDue !== null ? "PASS" : "FAIL",
  });

  // 6. Routing rules exist
  const routingCount = await prisma.helpdeskRoutingRule.count({ where: { isActive: true } });
  checks.push({ phase: 45, name: "helpdesk.routing_rules_exist", status: routingCount >= 1 ? "PASS" : "FAIL" });

  // 7. Default team exists
  const defaultTeam = await prisma.helpdeskTeam.findFirst({ where: { isDefault: true } });
  checks.push({ phase: 45, name: "helpdesk.default_team", status: defaultTeam ? "PASS" : "FAIL" });

  // 8. SLA policies exist (all 5 priorities)
  const slaCount = await prisma.helpdeskSlaPolicy.count({ where: { isActive: true } });
  checks.push({ phase: 45, name: "helpdesk.sla_policies", status: slaCount === 5 ? "PASS" : "FAIL" });

  // 9. Macros exist
  const macroCount = await prisma.helpdeskMacro.count({ where: { isActive: true } });
  checks.push({ phase: 45, name: "helpdesk.macros_exist", status: macroCount >= 1 ? "PASS" : "FAIL" });

  // 10. Resolve case → verify resolvedAt
  await resolveCase({ caseId: hdCase.id, staffActorId: "doctor_staff" });
  const resolved = await prisma.helpdeskCase.findUnique({ where: { id: hdCase.id } });
  checks.push({ phase: 45, name: "helpdesk.case_resolve", status: resolved?.resolvedAt !== null ? "PASS" : "FAIL" });

  // 11. Close case → verify closedAt
  await closeCase({ caseId: hdCase.id, staffActorId: "doctor_staff" });
  const closed = await prisma.helpdeskCase.findUnique({ where: { id: hdCase.id } });
  checks.push({ phase: 45, name: "helpdesk.case_close", status: closed?.closedAt !== null ? "PASS" : "FAIL" });

  // 12. Context service → returns enriched data
  const ctx = await getCaseContext(hdCase.id);
  checks.push({ phase: 45, name: "helpdesk.context_service", status: ctx?.case?.id === hdCase.id ? "PASS" : "FAIL" });

  // 13. RBAC roles seeded
  const agentRole = await prisma.role.findUnique({ where: { name: "HELPDESK_AGENT" } });
  const leadRole = await prisma.role.findUnique({ where: { name: "HELPDESK_LEAD" } });
  const mgrRole = await prisma.role.findUnique({ where: { name: "HELPDESK_MANAGER" } });
  checks.push({
    phase: 45, name: "helpdesk.rbac_roles_seeded",
    status: agentRole && leadRole && mgrRole ? "PASS" : "FAIL",
  });

  // Cleanup
  await prisma.caseMessage.deleteMany({ where: { caseId: hdCase.id } });
  await prisma.caseEvent.deleteMany({ where: { caseId: hdCase.id } });
  await prisma.caseWatcher.deleteMany({ where: { caseId: hdCase.id } });
  await prisma.helpdeskCase.delete({ where: { id: hdCase.id } });

  return checks;
}
```

---

## 14) Phase 45 Completion Criteria

- [ ] All Prisma models created and migrated (HelpdeskCase, CaseMessage, CaseEvent, CaseWatcher, HelpdeskTeam, HelpdeskTeamMember, HelpdeskRoutingRule, HelpdeskMacro, HelpdeskSlaPolicy, HelpdeskAutomationRule, HelpdeskSavedView, HelpdeskEmailConfig)
- [ ] Case lifecycle working (NEW → OPEN → PENDING_USER → RESOLVED → CLOSED)
- [ ] Case number generator producing HD-000001 format
- [ ] Message timeline with all directions (INBOUND, OUTBOUND, INTERNAL, SYSTEM)
- [ ] SLA calculator with per-priority targets
- [ ] Routing engine evaluating rules and auto-assigning
- [ ] Auto-assignment (least-loaded agent on team)
- [ ] Context service pulling from 10+ existing models
- [ ] Commerce linking (order, dispute, return, conversation, seller)
- [ ] Macros with variable interpolation
- [ ] Migration service (SupportTicket → HelpdeskCase) tested
- [ ] RBAC: HELPDESK_AGENT, HELPDESK_LEAD, HELPDESK_MANAGER roles seeded
- [ ] RBAC: Permission keys registered and enforced on all routes
- [ ] Middleware: Login routing (CS reps → /helpdesk, admins → /corp)
- [ ] Middleware: Route protection (helpdesk-only agents blocked from /corp)
- [ ] Middleware: Old routes (/corp/support, /corp/cases) redirect to /helpdesk
- [ ] Helpdesk layout (full-screen, own sidebar, own topbar)
- [ ] Topbar: back-to-admin button (visible only for corp-capable users)
- [ ] Topbar: theme toggle (dark/light, reads same next-themes provider)
- [ ] Dashboard page: stat cards, volume chart, team workload, SLA rings, activity feed
- [ ] Case queue page: filterable table, saved views, bulk actions, search
- [ ] Agent workspace page: timeline, composer (reply/internal note), context panel
- [ ] Teams management page
- [ ] Macros management page
- [ ] Routing rules page
- [ ] SLA policies page
- [ ] Reports page
- [ ] Settings page (email config)
- [ ] Corp sidebar: "Helpdesk" link added (navigates to /helpdesk)
- [ ] Buyer: /help submit form, /account/support my cases
- [ ] Seller: /seller/help submit form, /seller/support my cases
- [ ] Seed data: teams, SLA policies, routing rules, macros, email config
- [ ] Health provider `helpdesk` reports status
- [ ] Doctor passes all 13 Phase 45 checks
- [ ] ALL components use Tailwind dark: variants (zero inline style colors)
- [ ] TypeScript strict mode: zero errors

---

## 15) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-06 | Initial Phase 45 — Helpdesk V1 |

---

# END PHASE 45 INSTALL SPEC
