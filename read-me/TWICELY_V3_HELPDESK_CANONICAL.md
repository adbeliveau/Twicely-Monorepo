# TWICELY V3 — Helpdesk & Knowledge Base Canonical
**Version:** v1.0  
**Status:** LOCKED  
**Date:** 2026-02-15  
**Purpose:** Complete specification for the built-in helpdesk system (agent workspace, case lifecycle, SLA, routing, automation, CSAT) and knowledge base (public help center, internal articles, editor). Replaces any need for Chatwoot, Zendesk, or any third-party helpdesk SaaS.

This document has four parts:
- **Part A (§1–§5):** Architecture & Case Model — how the helpdesk fits into V3, case lifecycle, types, channels
- **Part B (§6–§13):** Agent Workspace — case detail, context panel, macros, teams, routing, SLA, automation, saved views
- **Part C (§14–§17):** User-Facing Support — buyer/seller case submission, case tracking, email integration, CSAT
- **Part D (§18–§22):** Knowledge Base — public help center, internal articles, editor, search, analytics
- **Part E (§23–§25):** Reports, Settings & Schema — helpdesk metrics, configurable settings, Drizzle schema sketch

---

## PART A: ARCHITECTURE & CASE MODEL

---

## 1. Why Build Our Own Helpdesk

V2 considered Chatwoot and Zendesk. Both were rejected:

- **Cost at scale.** Zendesk charges per-agent per-month. At 10 agents, that's $1,000+/mo for features we need selectively.
- **Commerce context gap.** No third-party helpdesk natively displays "this buyer's order, the seller's return response, the listing photos, and the tracking number" in a single pane. They all require custom integrations that break on updates.
- **Data sovereignty.** Case data lives in our database. No third-party data processing agreements. No export gymnastics.
- **Unified real-time.** Cases update via the same Centrifugo infrastructure as orders and messages. No separate WebSocket layer.
- **Brand continuity.** Buyers submit cases at `/h/contact` on twicely.co. Agents work at `/hd/*` on hub.twicely.co. Same design system, same auth, same app.

**Trade-off acknowledged:** We build more code. But the code is simpler than integrating Zendesk + maintaining the integration forever.

---

## 2. Architecture Overview

### 2.1 Two Surfaces, One System

| Surface | URL | Who Uses It | Purpose |
|---------|-----|-------------|---------|
| **Help Center** | `twicely.co/h/*` | Buyers, Sellers, Guests | Browse KB articles, submit cases, track cases |
| **Agent Workspace** | `hub.twicely.co/hd/*` | HELPDESK_AGENT, HELPDESK_LEAD, HELPDESK_MANAGER | Work cases, manage teams, routing, SLA, macros |

The helpdesk is a **separate full-screen app** at `/hd/*` on hub.twicely.co. It is NOT nested inside the Corp admin layout. It has its own sidebar, its own navigation, its own keyboard shortcuts. This is because agents live in the helpdesk all day — it must be optimized for their workflow, not shoehorned into a general admin UI.

### 2.2 Relationship to Other Hub Apps

```
hub.twicely.co
├── /d/*     → Corp Admin Dashboard (admin, support, moderation, finance roles)
├── /hd/*    → Helpdesk (helpdesk roles) ← THIS DOCUMENT
├── /kb/*    → Knowledge Base Editor (helpdesk_lead+, admin)
├── /cfg/*   → Platform Settings (admin)
└── ...other corp routes
```

Helpdesk agents can view user/order/listing data through the **context panel** (§7) without navigating to Corp admin. They never need to leave `/hd/*` for normal case work.

### 2.3 Real-Time Integration

Via Centrifugo channels (per TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md §15):

| Channel | Events |
|---------|--------|
| `private-case.{caseId}` | New message, status change, assignment change, SLA warning |
| `private-hd-agent.{staffUserId}` | New case assigned, SLA breach, mention |
| `private-hd-queue` | New case created (all agents subscribed to their team's queue) |

Agents see new messages appear instantly. No polling. No refresh.

---

## 3. Case Model

### 3.1 Case Types

| Type | Code | Auto-Created By | Description |
|------|------|-----------------|-------------|
| General Support | `SUPPORT` | Buyer/seller form submission | "How do I..." questions, account help |
| Order Issue | `ORDER` | Buyer/seller form (order-linked) | Shipping problems, wrong item, missing item |
| Return | `RETURN` | Return escalation (buyer rejects seller decline) | Return disputes that need platform intervention |
| Dispute | `DISPUTE` | Buyer protection claim escalation | INAD, INR, DAMAGED, COUNTERFEIT claims |
| Chargeback | `CHARGEBACK` | Stripe webhook (charge.dispute.created) | Payment disputes via card issuer |
| Billing | `BILLING` | Buyer/seller form | Subscription, fee, payout questions |
| Account | `ACCOUNT` | Buyer/seller form | Account access, 2FA recovery, verification |
| Moderation | `MODERATION` | Report message, report listing, system detection | Policy violations, flagged content |
| System | `SYSTEM` | Automated triggers | Auto-generated cases (SLA breach, fraud detection, etc.) |

### 3.2 Case Channels

| Channel | Code | Description |
|---------|------|-------------|
| Web | `WEB` | Submitted via `/h/contact` form |
| Email | `EMAIL` | Inbound email to support@twicely.co |
| System | `SYSTEM` | Auto-created by dispute/return/chargeback flow |
| Internal | `INTERNAL` | Created by platform agent (e.g., proactive outreach) |

No phone support. No live chat (V3 scope). Email and web are the two customer-facing channels.

### 3.3 Case Priority

| Priority | Code | SLA Target (First Response) | SLA Target (Resolution) | Use Case |
|----------|------|-----------------------------|------------------------|----------|
| Critical | `CRITICAL` | 1 hour | 4 hours | Chargebacks, account takeover, fraud |
| Urgent | `URGENT` | 2 hours | 8 hours | Active disputes, payment failures |
| High | `HIGH` | 4 hours | 24 hours | Returns, order issues, verification |
| Normal | `NORMAL` | 8 hours | 48 hours | General support, billing questions |
| Low | `LOW` | 24 hours | 72 hours | Feature requests, general feedback |

SLA targets are **business hours** by default (9 AM – 6 PM ET, Mon–Fri). Configurable per policy.

### 3.4 Case Status Lifecycle

```
                    ┌─────────────────────────────────────┐
                    │                                     │
NEW ──→ OPEN ──→ PENDING_USER ──→ OPEN ──→ RESOLVED ──→ CLOSED
  │       │            │                      │              │
  │       │            └── (user responds) ───┘              │
  │       │                                                  │
  │       ├──→ PENDING_INTERNAL ──→ OPEN                     │
  │       │                                                  │
  │       ├──→ ON_HOLD ──→ OPEN                              │
  │       │                                                  │
  │       └──→ ESCALATED ──→ OPEN                            │
  │                                                          │
  └── (auto-assigned) ──→ OPEN                               │
                                                             │
                    RESOLVED ←── (reopen within 7 days) ─────┘
```

| Status | Description | SLA Clock | Visible to User |
|--------|-------------|-----------|-----------------|
| `NEW` | Just created, not yet assigned or viewed | Running | "Received" |
| `OPEN` | Assigned to agent, being worked | Running | "In Progress" |
| `PENDING_USER` | Waiting for buyer/seller response | **Paused** | "Awaiting Your Reply" |
| `PENDING_INTERNAL` | Waiting for internal team (e.g., finance review) | Running | "In Progress" |
| `ON_HOLD` | Paused for external reason (awaiting carrier, Stripe) | **Paused** | "On Hold" |
| `ESCALATED` | Escalated to lead/manager for decision | Running | "Under Review" |
| `RESOLVED` | Agent marked resolved; buyer can reopen within 7 days | Stopped | "Resolved" |
| `CLOSED` | Finalized. No further action. Auto-closes 7 days after RESOLVED. | Stopped | "Closed" |

**Auto-close rule:** Cases in `RESOLVED` status auto-transition to `CLOSED` after 7 days with no new activity. Cases in `PENDING_USER` auto-close after 14 days with no response (configurable).

**Reopen rule:** User can reopen a `RESOLVED` case within 7 days by sending a new message. Reopened cases return to `OPEN` with the same agent assignment.

### 3.5 Case Number Format

Sequential: `HD-000001`, `HD-000002`, etc. Uses the `sequenceCounter` table with name `helpdesk_case` and prefix `HD-`.

Displayed everywhere: case list, case detail, email subject lines, user-facing case tracker.

---

## 4. Case Creation Flows

### 4.1 User-Initiated (Web)

1. Buyer/seller navigates to `/h/contact` (or clicks "Get Help" from order detail, return detail, etc.).
2. Form collects:
   - **Type** (dropdown): General, Order Issue, Return, Billing, Account
   - **Related order** (optional, searchable dropdown of user's orders — pre-filled if navigated from order page)
   - **Subject** (required, 10–200 chars)
   - **Description** (required, 50–5000 chars, rich text)
   - **Attachments** (optional, up to 5 files, max 10 MB each, image/PDF only)
3. System creates case with status `NEW`, channel `WEB`, priority `NORMAL`.
4. Routing rules evaluate (§10) → assign team and/or agent.
5. Auto-reply email sent if configured (§15).
6. User redirected to `/my/support/{caseNumber}` to track progress.

**Pre-filled context:** When user clicks "Get Help" from an order page, the form pre-fills the order reference and sets type to `ORDER`. Same for returns → type `RETURN`.

### 4.2 System-Initiated

| Trigger | Creates Case Type | Priority | Notes |
|---------|-------------------|----------|-------|
| Return escalated (buyer rejects seller decline) | `RETURN` | HIGH | Links returnRequestId |
| Buyer protection claim (seller no-response after 3 days) | `DISPUTE` | URGENT | Links disputeCaseId |
| Stripe charge.dispute.created webhook | `CHARGEBACK` | CRITICAL | Links orderId, payoutId |
| Message flagged for moderation | `MODERATION` | NORMAL | Links conversationId, listingId |
| Listing reported | `MODERATION` | NORMAL | Links listingId |
| Fraud detection trigger | `SYSTEM` | HIGH | Links userId, details in description |
| SLA breach on existing case (escalation) | Updates existing case | Upgrades priority | Status → ESCALATED |

System-created cases have channel `SYSTEM` and requesterType `system` (no human requester). The affected buyer/seller is linked via commerce fields (orderId, sellerId, etc.) and can be notified.

### 4.3 Agent-Initiated (Internal)

Agents create cases via `/hd/cases/new` for proactive outreach:
- Seller account review notices
- Fraud investigation cases
- Policy violation warnings
- Marketplace integrity checks

Channel = `INTERNAL`. Agent becomes the case creator but sets the `requesterId` to the affected user.

### 4.4 Email-Initiated

Inbound email to `support@twicely.co`:

1. Webhook from email provider receives parsed email.
2. Check `In-Reply-To` / `References` headers → if matches existing case `emailThreadId`, add message to that case.
3. If no match → create new case with channel `EMAIL`, subject from email subject line, description from email body.
4. If sender email matches a registered user → link as requester. Otherwise → store requesterEmail, requesterType `guest`.
5. Routing rules evaluate → assign.
6. Auto-reply with case number.

**Reply threading:** Every outbound email includes a unique `Message-ID` and sets `Reply-To` to `case+{caseId}@support.twicely.co`. Inbound replies to this address are routed to the correct case.

---

## 5. Commerce Context Linkage

The killer feature of our helpdesk vs. any third-party: every case can link to commerce entities.

| Field | Links To | Use Case |
|-------|----------|----------|
| `orderId` | Order | "My order hasn't arrived" — agent sees order, tracking, timeline |
| `listingId` | Listing | "This listing is counterfeit" — agent sees listing, photos, seller |
| `sellerId` | SellerProfile | Seller-related issues — agent sees seller stats, trust score |
| `payoutId` | Payout | Payout disputes — agent sees payout details, hold status |
| `disputeCaseId` | Dispute | Linked buyer protection claim |
| `returnRequestId` | Return | Linked return request |
| `conversationId` | Conversation | "Seller was rude" — agent sees message thread |

When a case has any of these links, the context panel (§7) automatically loads and displays the relevant data. Agent never has to search for it.

---

## PART B: AGENT WORKSPACE

---

## 6. Workspace Layout

### 6.1 Overall Structure

```
┌──────────────────────────────────────────────────────────────┐
│  Sidebar (collapsible)  │  Main Content Area                 │
│                         │                                    │
│  🏠 Dashboard           │  ┌─────────────────┬──────────────┐│
│  📋 My Cases            │  │ Case Queue /     │ Context      ││
│  📂 All Cases           │  │ Case Detail      │ Panel        ││
│  👁 Views               │  │                  │ (collapsible)││
│  ─────────────          │  │                  │              ││
│  📝 Macros              │  │                  │              ││
│  👥 Teams               │  │                  │              ││
│  🔀 Routing             │  │                  │              ││
│  ⏱ SLA                  │  │                  │              ││
│  ⚡ Automation           │  │                  │              ││
│  📊 Reports             │  │                  │              ││
│  ⚙ Settings             │  │                  │              ││
│                         │  └─────────────────┴──────────────┘│
└──────────────────────────────────────────────────────────────┘
```

Sidebar items gated by role:
- **HELPDESK_AGENT:** Dashboard, My Cases, All Cases, Views
- **HELPDESK_LEAD:** + Macros, Reports
- **HELPDESK_MANAGER:** + Teams, Routing, SLA, Automation, Settings

### 6.2 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Global search (cases, users, orders) |
| `R` | Reply to current case |
| `N` | Internal note on current case |
| `E` | Escalate current case |
| `M` | Open macro picker |
| `Cmd+Enter` | Send message/note |
| `Cmd+Shift+R` | Resolve current case |
| `←` / `→` | Previous/next case in queue |
| `1`–`5` | Set priority (1=Critical, 5=Low) |

Shortcuts only active when not focused on a text input. Shown in a discoverable tooltip panel (toggle with `?`).

---

## 7. Case Detail Page (Agent Workspace)

The most important page in the helpdesk. Three-column layout:

### 7.1 Left Column: Case Properties (280px fixed)

```
HD-000123
──────────────────
Status:     [OPEN ▼]          (dropdown)
Priority:   [NORMAL ▼]        (dropdown)
Type:       ORDER              (read-only badge)
Channel:    WEB                (read-only badge)

Assigned To: [Agent Name ▼]   (dropdown)
Team:        [General ▼]      (dropdown)

Tags:       [shipping] [late] [+ Add]

SLA
──────────────────
First Response: ⚠ 2h 15m left
Resolution:     ○ 22h left

Created:    Feb 15, 2026 10:30 AM
Updated:    Feb 15, 2026 11:45 AM
```

All dropdowns are inline-editable. Changes take effect immediately and create a CaseEvent. SLA shows countdown with color coding: green (>50% time remaining), yellow (25–50%), red (<25%), flashing red (breached).

### 7.2 Center Column: Conversation Thread

The timeline shows messages and events interleaved chronologically:

```
┌─────────────────────────────────────────┐
│ 📧 Jane Doe (Buyer)         10:30 AM   │
│ Hi, I ordered item X and it arrived     │
│ damaged. See attached photos.           │
│ [📎 photo1.jpg] [📎 photo2.jpg]        │
├─────────────────────────────────────────┤
│ ⚙ System                    10:30 AM   │
│ Case created. Routed to General Support.│
├─────────────────────────────────────────┤
│ ⚙ System                    10:31 AM   │
│ Assigned to Sarah (agent).              │
├─────────────────────────────────────────┤
│ 🔒 Sarah (Internal Note)    10:45 AM   │
│ Checking order ORD-005432 — tracking    │
│ shows delivered 2 days ago. Photos show │
│ clear shipping damage.                  │
├─────────────────────────────────────────┤
│ 💬 Sarah → Jane Doe         11:00 AM   │
│ Hi Jane, I'm sorry about the damage.   │
│ I've initiated a return for you. You'll │
│ receive a prepaid shipping label at...  │
│ 📄 KB: "How Returns Work" (sent)       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Reply    │  Internal Note   │  Macro ▼  │
├─────────────────────────────────────────┤
│                                         │
│  (rich text editor)                     │
│                                         │
│  [📎 Attach] [📄 KB Article]  [Send ▶] │
└─────────────────────────────────────────┘
```

**Message types rendered differently:**
- **Inbound (buyer/seller):** Left-aligned, light background, sender avatar + name
- **Outbound (agent reply):** Right-aligned, brand-colored background, "→" arrow with recipient name
- **Internal note:** Yellow background, lock icon, visible only to agents
- **System event:** Gray inline text, gear icon, no background bubble

**Compose area:**
- Tab toggle: **Reply** (sends to user) vs **Internal Note** (agents only)
- Rich text: bold, italic, links, bullet lists (no images in body — use attachments)
- Macro picker: searchable dropdown, inserts macro body, applies macro actions (status/priority/tags)
- KB article insertion: search articles, insert as formatted link with excerpt. Marks `sentToCustomer: true` on the KBCaseArticleLink.
- Attachments: drag-and-drop or click to upload. Max 5 files, max 10 MB each.
- `Cmd+Enter` to send.

### 7.3 Right Column: Context Panel (360px, collapsible)

This is what makes our helpdesk better than Zendesk. The context panel automatically loads data based on the case's commerce links.

**Always shown:**
```
REQUESTER
──────────────────
Jane Doe
jane@example.com
Member since: Jan 2025
Orders: 12  |  Cases: 2  |  Reviews: 8
Trust Score: 87 (GOOD)
[View Profile →]
```

**If orderId linked:**
```
ORDER
──────────────────
ORD-005432
Status: DELIVERED ✓
Placed: Feb 10, 2026
Total: $45.99
Seller: VintageFinds
Tracking: 1Z999AA10123456784
  └─ Delivered Feb 13, 2026

Items:
  📦 Nike Air Max 90 - $39.99
  📦 Shipping - $5.99

[View Order →]
```

**If listingId linked:**
```
LISTING
──────────────────
[Thumbnail] Nike Air Max 90
$39.99  |  ACTIVE
Condition: Good
Seller: VintageFinds
Listed: Feb 1, 2026

[View Listing →]
```

**If sellerId linked:**
```
SELLER
──────────────────
VintageFinds
Performance: GOOD (78)
Defect Rate: 1.2%
Late Ship: 2.8%
Active Listings: 342
Open Cases: 1

[View Seller →]
```

**If returnRequestId linked:**
```
RETURN
──────────────────
Status: ESCALATED
Reason: Item Not As Described
Requested: Feb 14, 2026
Seller Response: DECLINED
  "Item was described accurately"

[View Return →]
```

**If disputeCaseId linked:**
```
DISPUTE
──────────────────
Type: INAD
Status: UNDER_REVIEW
Filed: Feb 14, 2026
Evidence: 3 photos uploaded
Deadline: Feb 17, 2026

[View Dispute →]
```

**If conversationId linked:**
```
CONVERSATION
──────────────────
Between: Jane Doe ↔ VintageFinds
Re: Nike Air Max 90
Messages: 7
Last: Feb 14, 2026

[View Conversation →]
```

**Related Cases section (always shown if any exist):**
```
RELATED CASES
──────────────────
HD-000118 — Return request (RESOLVED)
HD-000095 — Shipping delay (CLOSED)
```

Related cases found by matching: same requesterId, same orderId, same sellerId, or same listingId.

**KB Articles (always shown):**
```
SUGGESTED ARTICLES
──────────────────
📄 How Returns Work
📄 Buyer Protection Policy
📄 Shipping Timeframes

[Link Article →]
```

Auto-suggested based on case type and tags. Agent can manually link articles which appear in the timeline when sent to customer.

---

## 8. Case Queue

### 8.1 Default Queue Views

| View | Filter | Sort |
|------|--------|------|
| **My Cases** | assignedAgentId = me, status ∈ {NEW, OPEN, PENDING_USER, PENDING_INTERNAL, ON_HOLD, ESCALATED} | SLA due soonest |
| **Unassigned** | assignedAgentId = null, status = NEW | Created oldest first |
| **All Open** | status ∈ {NEW, OPEN, PENDING_USER, PENDING_INTERNAL, ON_HOLD, ESCALATED} | SLA due soonest |
| **SLA Breached** | slaFirstResponseDue < now OR slaResolutionDue < now, status not RESOLVED/CLOSED | Breach duration longest |
| **Resolved** | status = RESOLVED | Resolved newest first |

### 8.2 Queue Columns

| Column | Description | Sortable |
|--------|-------------|----------|
| Case # | HD-000123 (link to detail) | Yes |
| Subject | Truncated to 60 chars | No |
| Requester | Name + email | Yes |
| Type | Badge (SUPPORT, ORDER, etc.) | Yes (filter) |
| Priority | Color-coded badge | Yes |
| Status | Badge | Yes (filter) |
| Agent | Avatar + name (or "Unassigned") | Yes (filter) |
| Team | Team name | Yes (filter) |
| SLA | Countdown or "Breached" in red | Yes |
| Updated | Relative time ("2h ago") | Yes |

### 8.3 Queue Filters

Filters are additive (AND logic). Available filters:

- Status (multi-select)
- Priority (multi-select)
- Type (multi-select)
- Channel (multi-select)
- Assigned Agent (multi-select, includes "Unassigned")
- Team (multi-select)
- Tags (multi-select)
- SLA Status (On Track / Warning / Breached)
- Created date range
- Updated date range

Active filters shown as removable chips above the queue. Filter state persisted in URL query params for shareability.

### 8.4 Bulk Actions

Select multiple cases (checkbox per row or select all) → bulk action bar:

- **Assign to agent** (dropdown)
- **Assign to team** (dropdown)
- **Change priority** (dropdown)
- **Add tags** (tag picker)
- **Change status** (RESOLVED only — can't bulk-close or bulk-reopen)

Bulk actions limited to 50 cases at once. All actions create individual CaseEvent records.

---

## 9. Macros (Canned Responses)

### 9.1 What a Macro Does

A macro is a pre-written response template + optional automated actions. When an agent applies a macro:

1. Macro body text inserted into the compose area (agent can edit before sending)
2. Optionally: status changed, priority changed, tags added
3. Agent sends the message (macro does NOT auto-send — agent always reviews)

### 9.2 Macro Structure

| Field | Type | Description |
|-------|------|-------------|
| title | string | Macro name shown in picker ("Refund Approved") |
| body | string (rich text) | Template text with variable placeholders |
| category | enum | `REFUND`, `SHIPPING`, `GENERAL`, `DISPUTE`, `RETURN`, `BILLING`, `ACCOUNT` |
| setStatus | CaseStatus? | Optional: change case status when applied |
| setPriority | CasePriority? | Optional: change case priority |
| addTags | string[] | Optional: add tags to case |
| isShared | boolean | true = all agents can use; false = only creator |
| isActive | boolean | Soft delete |
| sortOrder | int | Display order within category |
| createdByStaffId | string | Creator (StaffUser ID) |

### 9.3 Template Variables

| Variable | Resolves To |
|----------|-------------|
| `{{buyer_name}}` | Requester's display name |
| `{{case_number}}` | HD-000123 |
| `{{order_number}}` | ORD-005432 (if linked) |
| `{{agent_name}}` | Current agent's display name |
| `{{listing_title}}` | Linked listing title (if linked) |
| `{{seller_name}}` | Linked seller store name (if linked) |
| `{{return_status}}` | Linked return status (if linked) |

Variables that can't resolve (no linked entity) render as empty string. Agent sees preview before sending.

### 9.4 Management

- HELPDESK_LEAD+ can create/edit shared macros at `/hd/macros`
- All agents can create personal macros (isShared = false)
- Macros organized by category in the picker
- Macro picker searchable by title
- Usage count tracked per macro (for reports)

---

## 10. Teams

### 10.1 Team Structure

| Field | Type | Description |
|-------|------|-------------|
| name | string (unique) | Internal identifier ("general-support") |
| displayName | string | Shown in UI ("General Support") |
| description | string? | Team purpose |
| isDefault | boolean | Fallback team when no routing rule matches (exactly one) |
| isActive | boolean | Soft delete |

### 10.2 Team Membership

| Field | Type | Description |
|-------|------|-------------|
| teamId | FK | Team reference |
| userId | FK | StaffUser ID |
| role | enum | `AGENT`, `LEAD`, `MANAGER` |
| maxConcurrentCases | int | Max open cases for this agent on this team (default 25) |
| isAvailable | boolean | Agent availability toggle (manual or auto-set by schedule) |

An agent can belong to **multiple teams**. Their concurrent case limit is per-team (an agent on two teams with 25 max each could have up to 50 total cases).

### 10.3 Default Teams (Seeded)

| Team | Purpose | Default? |
|------|---------|----------|
| General Support | Account, billing, general questions | ✅ |
| Order Support | Order issues, shipping, tracking | |
| Trust & Safety | Disputes, returns, buyer protection | |
| Moderation | Listing reports, message reports, policy violations | |
| Escalations | Complex cases requiring manager decision | |

---

## 11. Routing Rules

### 11.1 How Routing Works

When a case is created, routing rules evaluate **in sort order** (lowest first). The first matching rule applies. If no rule matches, the case goes to the **default team** and is unassigned (round-robin within team).

### 11.2 Rule Structure

| Field | Type | Description |
|-------|------|-------------|
| name | string | Rule name ("Chargebacks → Trust & Safety") |
| sortOrder | int | Evaluation priority (lower = first) |
| isActive | boolean | Enable/disable without deleting |
| conditionsJson | JSON | Array of conditions, evaluated as AND |
| assignTeamId | FK? | Assign to this team |
| assignAgentId | FK? | Assign to specific agent (optional) |
| setPriority | CasePriority? | Override default priority |
| addTags | string[] | Auto-add tags |
| setCategory | string? | Set case category |

### 11.3 Condition Operators

| Field | Operators | Example |
|-------|-----------|---------|
| type | equals, in | `{field: "type", op: "equals", value: "CHARGEBACK"}` |
| channel | equals, in | `{field: "channel", op: "in", value: ["EMAIL","WEB"]}` |
| priority | equals, in, gte, lte | `{field: "priority", op: "gte", value: "HIGH"}` |
| subject | contains, startsWith | `{field: "subject", op: "contains", value: "refund"}` |
| tags | contains | `{field: "tags", op: "contains", value: "chargeback"}` |
| requesterType | equals | `{field: "requesterType", op: "equals", value: "seller"}` |

### 11.4 Default Routing Rules (Seeded)

| # | Name | Conditions | Action |
|---|------|-----------|--------|
| 1 | Chargebacks → Trust | type = CHARGEBACK | Team: Trust & Safety, Priority: CRITICAL |
| 2 | Disputes → Trust | type = DISPUTE | Team: Trust & Safety, Priority: URGENT |
| 3 | Returns → Trust | type = RETURN | Team: Trust & Safety, Priority: HIGH |
| 4 | Moderation → Moderation | type = MODERATION | Team: Moderation |
| 5 | Order Issues → Orders | type = ORDER | Team: Order Support |
| 6 | Account Issues → General | type = ACCOUNT | Team: General Support |
| 7 | Billing → General | type = BILLING | Team: General Support |

### 11.5 Assignment Within a Team

When a rule assigns to a team (not a specific agent), **round-robin** assignment:

1. Get all team members where `isAvailable = true`
2. Filter out agents at `maxConcurrentCases` limit
3. Assign to the available agent with the fewest open cases on this team
4. If all agents at capacity → case stays unassigned on team queue
5. If no available agents → case stays unassigned on team queue

---

## 12. SLA Policies

### 12.1 Policy Per Priority

| Priority | First Response (business hours) | Resolution (business hours) | Escalate on Breach |
|----------|---------------------------------|-----------------------------|-------------------|
| CRITICAL | 60 min | 240 min (4h) | Yes → Escalations team |
| URGENT | 120 min (2h) | 480 min (8h) | Yes → Escalations team |
| HIGH | 240 min (4h) | 1440 min (24h) | Yes → team lead |
| NORMAL | 480 min (8h) | 2880 min (48h) | No |
| LOW | 1440 min (24h) | 4320 min (72h) | No |

### 12.2 SLA Clock Rules

- **Starts** when case is created (status = NEW)
- **Pauses** when status = `PENDING_USER` or `ON_HOLD`
- **Resumes** when status returns to `OPEN` (user responds, hold lifted)
- **First Response met** when first non-system, non-internal outbound message is sent
- **Resolution met** when status transitions to `RESOLVED`

### 12.3 SLA Warnings

| Condition | Action |
|-----------|--------|
| 75% of first response time elapsed | Yellow warning icon in queue + agent notification |
| 100% of first response time elapsed (breach) | Red icon, CaseEvent logged, escalation if configured |
| 75% of resolution time elapsed | Yellow warning in queue |
| 100% of resolution time elapsed (breach) | Red icon, CaseEvent logged, manager notification |

### 12.4 Business Hours

Default: 9:00 AM – 6:00 PM ET, Monday–Friday. Configurable in helpdesk settings. SLA timers only count business-hours minutes unless `businessHoursOnly = false` on the policy (used for CRITICAL cases that need 24/7 response).

---

## 13. Automation Rules

### 13.1 How Automation Works

Automation rules are event-driven. When a trigger event fires, conditions are evaluated, and actions execute if all conditions match. Unlike routing (runs once on creation), automation rules can fire on any event throughout a case's lifecycle.

### 13.2 Trigger Events

| Trigger | Code | Fires When |
|---------|------|------------|
| Case Created | `CASE_CREATED` | New case enters system |
| Status Changed | `STATUS_CHANGED` | Any status transition |
| Priority Changed | `PRIORITY_CHANGED` | Priority upgraded or downgraded |
| SLA Warning | `SLA_WARNING` | 75% of SLA target elapsed |
| SLA Breached | `SLA_BREACHED` | SLA target exceeded |
| No Response | `NO_RESPONSE` | Configurable hours since last activity |
| Agent Assigned | `AGENT_ASSIGNED` | Case assigned to new agent |
| Message Received | `MESSAGE_RECEIVED` | New inbound message from user |
| Case Reopened | `CASE_REOPENED` | Resolved case reopened by user |

### 13.3 Available Actions

| Action | Code | Description |
|--------|------|-------------|
| Set Priority | `SET_PRIORITY` | Change case priority |
| Assign Team | `ASSIGN_TEAM` | Reassign to different team |
| Assign Agent | `ASSIGN_AGENT` | Assign to specific agent |
| Add Tags | `ADD_TAGS` | Add tags to case |
| Remove Tags | `REMOVE_TAGS` | Remove tags from case |
| Set Status | `SET_STATUS` | Change case status |
| Send Notification | `SEND_NOTIFICATION` | Email/push notification to agent or user |
| Add Internal Note | `ADD_NOTE` | System-generated internal note |

### 13.4 Default Automation Rules (Seeded)

| # | Name | Trigger | Conditions | Action |
|---|------|---------|-----------|--------|
| 1 | Auto-close stale pending | NO_RESPONSE | status = PENDING_USER, hours ≥ 336 (14 days) | Status → CLOSED, note "Auto-closed: no user response" |
| 2 | SLA breach escalation (CRITICAL) | SLA_BREACHED | priority = CRITICAL | Status → ESCALATED, Team → Escalations, notify manager |
| 3 | SLA breach escalation (URGENT) | SLA_BREACHED | priority = URGENT | Status → ESCALATED, Team → Escalations, notify lead |
| 4 | Reopen notification | CASE_REOPENED | (none) | Notify assigned agent, add tag "reopened" |
| 5 | Welcome message received | MESSAGE_RECEIVED | status = PENDING_USER | Status → OPEN |

---

## PART C: USER-FACING SUPPORT

---

## 14. Help Center (`/h/*`)

### 14.1 Help Center Home (`/h`)

```
┌─────────────────────────────────────────────┐
│           🔍 How can we help?               │
│  [Search articles and common questions...] │
├─────────────────────────────────────────────┤
│                                             │
│  📦 Orders & Shipping    💰 Payments        │
│  📦 Returns & Refunds    🏪 Selling         │
│  🛡 Buyer Protection     📋 Account         │
│  🔗 Crosslister          📜 Policies        │
│                                             │
├─────────────────────────────────────────────┤
│  Popular Articles                           │
│  • How do I request a return?               │
│  • How does Buyer Protection work?          │
│  • How do I track my order?                 │
│  • What are the selling fees?               │
│  • How do I import from eBay?               │
├─────────────────────────────────────────────┤
│  Still need help?                           │
│  [Contact Support →]                        │
└─────────────────────────────────────────────┘
```

- Search bar with typeahead → Typesense `kb-search` index
- Category grid → each links to `/h/c/{slug}`
- Popular articles → based on viewCount, admin-pinnable
- "Contact Support" → links to `/h/contact`
- Fully server-rendered for SEO

### 14.2 Category Page (`/h/c/{slug}`)

- Category title + description
- Subcategories (if any)
- Article list with title + excerpt
- Sorted by sortOrder (admin-controlled)
- Breadcrumb: Help Center > Category > Subcategory

### 14.3 Article Page (`/h/{article-slug}`)

- Title, body (rendered HTML/markdown), last updated date
- Sidebar: related articles, table of contents (auto-generated from headings)
- Bottom: "Was this article helpful?" → Yes / No (with optional comment on No)
- Bottom: "Still need help? [Contact Support →]"
- Server-rendered for SEO with proper meta tags

### 14.4 Audience Gating

| Audience | Visible To |
|----------|------------|
| ALL | Everyone (including guests) |
| BUYER | Authenticated users |
| SELLER | Users with seller profile |
| AGENT_ONLY | Only visible in helpdesk context panel, not on public help center |

---

## 15. Email Integration

### 15.1 Outbound Email

When an agent sends a reply (not internal note):

1. Message saved to `caseMessage` with direction `OUTBOUND`
2. Email queued via `helpdesk-email` provider usage mapping
3. Email includes:
   - From: "Twicely Support" <support@twicely.co>
   - Reply-To: case+{caseId}@support.twicely.co
   - Subject: `Re: [{caseNumber}] {subject}`
   - Headers: `Message-ID`, `In-Reply-To` (previous message), `References` (thread)
   - Body: agent's message as HTML + plain text fallback
   - Footer: "Reply to this email to update your case. Case reference: {caseNumber}"
4. Delivery status tracked: PENDING → SENT → DELIVERED (or FAILED/BOUNCED)
5. Delivery failures surface in case timeline as system event

### 15.2 Inbound Email

Webhook receives parsed email from email provider:

1. Parse sender email, subject, body (HTML → sanitized HTML + plain text extraction), attachments
2. Check threading headers → match to existing case
3. If match: add as inbound message, update lastActivityAt, set status → OPEN if was PENDING_USER
4. If no match: create new case (channel = EMAIL)
5. Strip email signatures (best-effort, configurable pattern list)
6. Store attachments in R2 (`helpdesk-attachments` usage mapping)

### 15.3 Auto-Reply

When a new case is created (any channel), if auto-reply is enabled:

1. Send email to requester with:
   - Case number
   - Expected response time (from SLA policy for case priority)
   - Link to track case at `/my/support/{caseNumber}`
   - Suggested KB articles (top 3 by relevance to subject/description)
2. Auto-reply uses `helpdesk.case.auto_reply` notification template
3. Auto-reply does NOT count as first response for SLA purposes

### 15.4 Email Config (Singleton)

| Setting | Default | Description |
|---------|---------|-------------|
| fromName | "Twicely Support" | Sender display name |
| replyToPattern | `case+{{caseId}}@support.twicely.co` | Reply-To for threading |
| emailUsageKey | "helpdesk-email" | Provider mapping for sending |
| emailFooterText | "Reply to this email..." | Footer appended to all outbound |
| autoReplyEnabled | true | Send auto-reply on new case |
| autoReplyTemplateKey | "helpdesk.case.auto_reply" | Notification template |
| inboundAddress | support@twicely.co | Monitored inbound address |
| inboundEnabled | true | Process inbound email |
| resolvedRetentionDays | 365 | Days to keep resolved case data |

---

## 16. User Case Tracking

### 16.1 My Support Cases (`/my/support`)

Authenticated users see their submitted cases:

| Column | Description |
|--------|-------------|
| Case # | HD-000123 (link to detail) |
| Subject | Case subject |
| Status | User-friendly label (see §3.4) |
| Updated | Relative time |

Sorted by last activity, most recent first. Filter by status (Open / Resolved / Closed).

### 16.2 Case Detail (`/my/support/{caseNumber}`)

User sees:

- Case number, subject, status (user-friendly label)
- Timeline of **non-internal** messages only (internal notes hidden from user)
- System events shown as neutral status updates ("Your case has been assigned", "Waiting for your reply")
- Reply form: text + attachments (same constraints as creation)
- User reply creates inbound message, sets status → OPEN if was PENDING_USER

### 16.3 "Get Help" Entry Points

| Location | Pre-fills |
|----------|-----------|
| `/my/buying/orders/{id}` → "Get Help" button | Type: ORDER, orderId |
| `/my/buying/orders/{id}/return` → escalation | Type: RETURN, returnRequestId, orderId |
| Buyer protection claim → seller no-response | Type: DISPUTE, disputeCaseId, orderId |
| `/my/selling/orders/{id}` → "Get Help" (seller) | Type: ORDER, orderId, sellerId |
| `/my/settings` → "Contact Support" | Type: ACCOUNT |
| Any listing → "Report" button | Type: MODERATION, listingId |
| Any message → "Report" button | Type: MODERATION, conversationId |

---

## 17. CSAT (Customer Satisfaction)

### 17.1 When CSAT Is Collected

When a case moves to `RESOLVED`:

1. Email sent to requester: "How was your experience?"
2. Also shown as inline prompt on the case detail page (`/my/support/{caseNumber}`)
3. Survey available for 7 days (until case auto-closes)

### 17.2 CSAT Scale

| Rating | Label | Emoji |
|--------|-------|-------|
| 1 | Very Unsatisfied | 😡 |
| 2 | Unsatisfied | 😟 |
| 3 | Neutral | 😐 |
| 4 | Satisfied | 🙂 |
| 5 | Very Satisfied | 😊 |

Optional comment field (500 chars max) shown after rating selection.

### 17.3 CSAT Data Model

| Field | Type | Description |
|-------|------|-------------|
| caseId | FK | Case reference |
| rating | int (1–5) | CSAT score |
| comment | string? | Optional feedback |
| submittedAt | timestamp | When submitted |

One CSAT per case. Cannot be edited after submission. Agent sees CSAT on case detail (after submission). Used in helpdesk reports.

---

## PART D: KNOWLEDGE BASE

---

## 18. Knowledge Base Architecture

### 18.1 Two Contexts

| Context | URL | Audience | Purpose |
|---------|-----|----------|---------|
| Public Help Center | `twicely.co/h/*` | Buyers, Sellers, Guests | Self-service support |
| Agent Reference | Context panel in `/hd/*` | Helpdesk agents | Quickly link articles to cases |
| KB Editor | `hub.twicely.co/kb/*` | HELPDESK_LEAD+, ADMIN | Create and manage articles |

### 18.2 Content Structure

```
Knowledge Base
├── Category (e.g., "Orders & Shipping")
│   ├── Subcategory (e.g., "Tracking")
│   │   ├── Article: "How to track your order"
│   │   ├── Article: "My tracking isn't updating"
│   │   └── Article: "Shipping carriers we support"
│   └── Subcategory (e.g., "Delivery Issues")
│       ├── Article: "What if my item isn't delivered?"
│       └── Article: "Item arrived damaged"
└── Category (e.g., "Selling")
    └── ...
```

Categories are two levels deep max (category → subcategory). Articles belong to exactly one category/subcategory.

---

## 19. Article Model

### 19.1 Fields

| Field | Type | Description |
|-------|------|-------------|
| id | CUID2 | Primary key |
| slug | string (unique) | URL slug: "how-to-track-your-order" |
| categoryId | FK | Category reference |
| title | string | Article title (max 200 chars) |
| excerpt | string? | Short summary for search results and article cards (max 300 chars) |
| body | string | Full article content |
| bodyFormat | enum | `MARKDOWN`, `HTML`, `RICHTEXT` |
| status | enum | `DRAFT`, `REVIEW`, `PUBLISHED`, `ARCHIVED` |
| isPublished | boolean | Computed from status = PUBLISHED |
| publishedAt | timestamp? | When first published |
| audience | enum | `ALL`, `BUYER`, `SELLER`, `AGENT_ONLY` |
| sortOrder | int | Display order within category |
| isFeatured | boolean | Shown on help center home |
| isPinned | boolean | Pinned to top of category |
| metaTitle | string? | SEO override |
| metaDescription | string? | SEO override |
| tags | string[] | Searchable tags |
| searchKeywords | string[] | Additional search terms (not displayed) |
| viewCount | int | Incremented on page view (debounced per session) |
| helpfulYes | int | "Was this helpful?" Yes count |
| helpfulNo | int | "Was this helpful?" No count |
| version | int | Incremented on each publish |
| authorStaffId | FK | Original author (StaffUser ID) |
| lastEditedById | FK | Last editor (StaffUser ID) |

### 19.2 Article Status Lifecycle

```
DRAFT → REVIEW → PUBLISHED → ARCHIVED
  ↑        ↓         ↓
  └── (rejected) ──┘ └── (edit) → DRAFT (creates new version)
```

- **DRAFT:** Work in progress. Not visible publicly.
- **REVIEW:** Ready for lead/admin approval. Not visible publicly.
- **PUBLISHED:** Live on help center. Indexed in Typesense.
- **ARCHIVED:** Removed from help center. Still accessible to agents for historical reference.

Editing a published article creates a new draft version. Publishing the draft increments the version number and replaces the live content.

### 19.3 Article Relations

Articles can link to each other:

| Relation Type | Description |
|---------------|-------------|
| `related` | "See also" — shown in sidebar |
| `prerequisite` | "Read first" — shown above article body |

### 19.4 Article Attachments

Files attached to articles (PDFs, images, diagrams) stored in R2 via `kb-attachments` usage mapping.

### 19.5 Article-Case Links

When an agent links a KB article to a case (`KBCaseArticleLink`):

- Article appears in case timeline as "📄 Article: {title} (linked)"
- If `sentToCustomer = true`, article is included in the outbound reply as a formatted link with excerpt
- Tracks which articles are most useful for which case types (analytics)

---

## 20. KB Categories

### 20.1 Fields

| Field | Type | Description |
|-------|------|-------------|
| id | CUID2 | Primary key |
| slug | string (unique) | URL slug |
| parentId | FK? | Parent category (null = top-level) |
| name | string | Display name |
| description | string? | Category description (shown on category page) |
| icon | string? | Icon name (Lucide icon) |
| sortOrder | int | Display order |
| isPublished | boolean | Visible on help center |
| audience | enum | `ALL`, `BUYER`, `SELLER`, `AGENT_ONLY` |
| metaTitle | string? | SEO override |
| metaDescription | string? | SEO override |

### 20.2 Default Categories (Seeded)

| Category | Slug | Icon | Audience |
|----------|------|------|----------|
| Orders & Shipping | `orders-shipping` | Package | ALL |
| Returns & Refunds | `returns-refunds` | RefreshCw | ALL |
| Payments & Billing | `payments-billing` | CreditCard | ALL |
| Buyer Protection | `buyer-protection` | Shield | ALL |
| Selling on Twicely | `selling` | Store | SELLER |
| Crosslister | `crosslister` | Link2 | SELLER |
| Account & Settings | `account` | User | ALL |
| Policies | `policies` | FileText | ALL |

---

## 21. KB Editor (`hub.twicely.co/kb/*`)

### 21.1 Editor Routes

| Route | Page | Min Role |
|-------|------|----------|
| `/kb` | Article list (all statuses) | HELPDESK_LEAD |
| `/kb/new` | New article editor | HELPDESK_LEAD |
| `/kb/{slug}` | Edit article | HELPDESK_LEAD |
| `/kb/categories` | Category management | HELPDESK_MANAGER |

### 21.2 Article List

Table view with columns: Title, Category, Status (badge), Audience, Views, Helpful %, Updated, Author.

Filters: Status, Category, Audience. Search by title/content.

### 21.3 Article Editor

**Editor choice:** TBD (Tiptap, Novel, or BlockNote — decision deferred per tech stack doc). Must support:
- Headings (H2, H3, H4)
- Bold, italic, links
- Ordered and unordered lists
- Code blocks
- Images (inline, uploaded to R2)
- Tables
- Callout boxes (info, warning, tip)
- Embeds (YouTube, Loom)

**Editor sidebar:**
- Category selector (dropdown)
- Audience selector
- Tags (freeform)
- Search keywords (freeform)
- SEO fields (title, description)
- Featured toggle
- Pinned toggle
- Related articles (search + link)

**Editor toolbar:**
- Save Draft
- Submit for Review (→ REVIEW status)
- Publish (HELPDESK_MANAGER+ only, or ADMIN)
- Archive
- Preview (opens public view in new tab)

### 21.4 Article Feedback

Readers see "Was this article helpful?" at the bottom of every article. Results:

- **Yes** → increment helpfulYes, store feedback record
- **No** → show optional comment field (500 chars), increment helpfulNo, store feedback record

Feedback table:

| Field | Type | Description |
|-------|------|-------------|
| articleId | FK | Article reference |
| isHelpful | boolean | Yes/No |
| comment | string? | Optional (only on "No") |
| userId | FK? | If authenticated |
| sessionId | string? | If guest |
| createdAt | timestamp | When submitted |

One feedback per user per article (deduplicated by userId or sessionId + IP hash).

---

## 22. KB Search

### 22.1 Typesense Index

Index name: `kb_articles`. Searchable fields:

| Field | Weight | Source |
|-------|--------|--------|
| title | 5.0 | Article title |
| excerpt | 3.0 | Article excerpt |
| body | 1.0 | Full article body (plain text extracted) |
| tags | 4.0 | Article tags |
| searchKeywords | 4.0 | Additional keywords |

Filter fields: `categorySlug`, `audience`, `status`, `isFeatured`.

### 22.2 Search Behavior

**Public help center search** (`/h?q=...`):
- Only searches articles where `status = PUBLISHED` and `audience` matches user's identity
- Returns: title, excerpt, category, slug
- Typesense handles typo tolerance and ranking

**Agent context panel search** (within case detail):
- Searches all published articles including `AGENT_ONLY`
- Results shown with "Link to Case" and "Send to Customer" actions

---

## PART E: REPORTS, SETTINGS & SCHEMA

---

## 23. Helpdesk Reports (`/hd/reports`)

### 23.1 Dashboard Metrics (Live)

| Metric | Description |
|--------|-------------|
| Open Cases | Current count by status |
| Avg First Response Time | Rolling 30 days |
| Avg Resolution Time | Rolling 30 days |
| SLA Compliance % | First response + resolution combined |
| CSAT Score | Average rating, rolling 30 days |
| Cases by Type | Pie chart |
| Cases by Channel | Pie chart |
| Agent Workload | Bar chart (open cases per agent) |

### 23.2 Detailed Reports

| Report | Description | Filters |
|--------|-------------|---------|
| Volume Report | Cases created/resolved over time | Date range, type, channel, team |
| SLA Report | Breach rate by priority, team, agent | Date range, priority, team |
| Agent Performance | Cases handled, avg response/resolution time, CSAT per agent | Date range, team |
| Resolution Report | Resolution rate, reopen rate, avg time to resolve | Date range, type |
| CSAT Report | Average score, distribution, comments | Date range, agent, team, type |
| Tag Report | Case volume by tag (identifies trending issues) | Date range |
| KB Effectiveness | Articles linked to cases, deflection rate estimate | Date range, category |

Reports exportable as CSV. Date range presets: Today, This Week, This Month, Last 30 Days, Custom Range.

---

## 24. Helpdesk Settings (`/hd/settings`)

Accessible to HELPDESK_MANAGER and ADMIN. Stored in `platformSetting` table (per Platform Settings Canonical).

### 24.1 Settings Inventory

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `helpdesk.businessHours.start` | string | "09:00" | Business hours start (UTC) |
| `helpdesk.businessHours.end` | string | "18:00" | Business hours end (UTC) |
| `helpdesk.businessHours.timezone` | string | "America/New_York" | Business hours timezone |
| `helpdesk.businessHours.workDays` | array | [1,2,3,4,5] | Monday=1 through Sunday=7 |
| `helpdesk.autoClose.pendingUserDays` | number | 14 | Days before auto-closing PENDING_USER cases |
| `helpdesk.autoClose.resolvedDays` | number | 7 | Days before auto-closing RESOLVED cases |
| `helpdesk.reopen.windowDays` | number | 7 | Days after resolution that user can reopen |
| `helpdesk.csat.enabled` | boolean | true | Collect CSAT on resolved cases |
| `helpdesk.csat.surveyDelayMinutes` | number | 30 | Delay before sending CSAT email after resolution |
| `helpdesk.roundRobin.enabled` | boolean | true | Auto-assign new cases round-robin |
| `helpdesk.email.signatureStripEnabled` | boolean | true | Strip email signatures on inbound |
| `helpdesk.maxAttachments` | number | 5 | Max attachments per message |
| `helpdesk.maxAttachmentSizeMb` | number | 10 | Max file size per attachment |
| `helpdesk.retentionDays` | number | 365 | Days to keep resolved case data |

---

## 25. Drizzle Schema Sketch

### 25.1 Enums

```typescript
export const caseTypeEnum = pgEnum('case_type', [
  'SUPPORT', 'ORDER', 'RETURN', 'DISPUTE',
  'CHARGEBACK', 'BILLING', 'ACCOUNT', 'MODERATION', 'SYSTEM'
]);

export const caseStatusEnum = pgEnum('case_status', [
  'NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL',
  'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED'
]);

export const casePriorityEnum = pgEnum('case_priority', [
  'CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW'
]);

export const caseChannelEnum = pgEnum('case_channel', [
  'WEB', 'EMAIL', 'SYSTEM', 'INTERNAL'
]);

export const caseMessageDirectionEnum = pgEnum('case_message_direction', [
  'INBOUND', 'OUTBOUND', 'INTERNAL', 'SYSTEM'
]);

export const caseMessageDeliveryStatusEnum = pgEnum('case_message_delivery_status', [
  'PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED'
]);

export const kbArticleStatusEnum = pgEnum('kb_article_status', [
  'DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'
]);

export const kbAudienceEnum = pgEnum('kb_audience', [
  'ALL', 'BUYER', 'SELLER', 'AGENT_ONLY'
]);

export const kbBodyFormatEnum = pgEnum('kb_body_format', [
  'MARKDOWN', 'HTML', 'RICHTEXT'
]);
```

### 25.2 Core Tables

```typescript
export const helpdeskCase = pgTable('helpdesk_case', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseNumber:          text('case_number').notNull().unique(),

  // Type & channel
  type:                caseTypeEnum('type').notNull(),
  channel:             caseChannelEnum('channel').notNull().default('WEB'),

  // Content
  subject:             text('subject').notNull(),
  description:         text('description'),

  // Status & priority
  status:              caseStatusEnum('status').notNull().default('NEW'),
  priority:            casePriorityEnum('priority').notNull().default('NORMAL'),

  // Requester
  requesterId:         text('requester_id').notNull(),      // User ID
  requesterEmail:      text('requester_email'),
  requesterType:       text('requester_type').notNull().default('buyer'), // buyer | seller | system

  // Assignment
  assignedTeamId:      text('assigned_team_id'),
  assignedAgentId:     text('assigned_agent_id'),            // StaffUser ID

  // Commerce links
  orderId:             text('order_id'),
  listingId:           text('listing_id'),
  sellerId:            text('seller_id'),
  payoutId:            text('payout_id'),
  disputeCaseId:       text('dispute_case_id'),
  returnRequestId:     text('return_request_id'),
  conversationId:      text('conversation_id'),

  // SLA
  slaFirstResponseDue: timestamp('sla_first_response_due', { withTimezone: true }),
  slaFirstResponseAt:  timestamp('sla_first_response_at', { withTimezone: true }),
  slaResolutionDue:    timestamp('sla_resolution_due', { withTimezone: true }),
  slaResolutionAt:     timestamp('sla_resolution_at', { withTimezone: true }),

  // Email threading
  emailThreadId:       text('email_thread_id'),
  emailSubjectLine:    text('email_subject_line'),

  // Metadata
  tags:                text('tags').array().notNull().default(sql`'{}'::text[]`),
  category:            text('category'),
  source:              text('source'),

  // Timestamps
  firstResponseAt:     timestamp('first_response_at', { withTimezone: true }),
  resolvedAt:          timestamp('resolved_at', { withTimezone: true }),
  closedAt:            timestamp('closed_at', { withTimezone: true }),
  reopenedAt:          timestamp('reopened_at', { withTimezone: true }),
  lastActivityAt:      timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusPriorityIdx:     index('hdc_status_priority').on(table.status, table.priority, table.createdAt),
  assignedAgentIdx:      index('hdc_agent_status').on(table.assignedAgentId, table.status),
  assignedTeamIdx:       index('hdc_team_status').on(table.assignedTeamId, table.status),
  requesterIdx:          index('hdc_requester').on(table.requesterId, table.createdAt),
  orderIdx:              index('hdc_order').on(table.orderId),
  sellerIdx:             index('hdc_seller').on(table.sellerId),
  disputeIdx:            index('hdc_dispute').on(table.disputeCaseId),
  returnIdx:             index('hdc_return').on(table.returnRequestId),
  slaFirstResponseIdx:   index('hdc_sla_first').on(table.slaFirstResponseDue),
  slaResolutionIdx:      index('hdc_sla_resolution').on(table.slaResolutionDue),
  typeStatusIdx:         index('hdc_type_status').on(table.type, table.status),
  lastActivityIdx:       index('hdc_last_activity').on(table.lastActivityAt),
}));

export const caseMessage = pgTable('case_message', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),

  // Direction
  direction:           caseMessageDirectionEnum('direction').notNull(),

  // Author
  authorId:            text('author_id'),                    // null for system messages
  authorName:          text('author_name'),
  authorEmail:         text('author_email'),
  authorType:          text('author_type').notNull().default('agent'), // agent | buyer | seller | system

  // Content
  body:                text('body').notNull(),
  bodyHtml:            text('body_html'),
  isInternal:          boolean('is_internal').notNull().default(false),

  // Email metadata
  emailMessageId:      text('email_message_id'),
  emailInReplyTo:      text('email_in_reply_to'),
  emailReferences:     text('email_references').array().notNull().default(sql`'{}'::text[]`),

  // Delivery
  deliveryStatus:      caseMessageDeliveryStatusEnum('delivery_status').notNull().default('PENDING'),
  deliveredAt:         timestamp('delivered_at', { withTimezone: true }),
  deliveryError:       text('delivery_error'),

  // Attachments (JSON array)
  attachments:         jsonb('attachments').notNull().default('[]'),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseCreatedIdx:      index('cm_case_created').on(table.caseId, table.createdAt),
  emailMessageIdx:     index('cm_email_msg').on(table.emailMessageId),
  directionIdx:        index('cm_direction').on(table.direction, table.caseId),
}));

export const caseEvent = pgTable('case_event', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),

  eventType:           text('event_type').notNull(),
  description:         text('description').notNull(),

  actorId:             text('actor_id'),
  actorName:           text('actor_name'),
  actorType:           text('actor_type').notNull().default('system'), // agent | system | automation

  oldValue:            text('old_value'),
  newValue:            text('new_value'),
  metaJson:            jsonb('meta_json').notNull().default('{}'),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseCreatedIdx:      index('ce_case_created').on(table.caseId, table.createdAt),
  eventTypeIdx:        index('ce_event_type').on(table.eventType),
}));

export const caseWatcher = pgTable('case_watcher', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),
  userId:              text('user_id').notNull(),             // StaffUser ID
  addedAt:             timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueCaseUser:      unique().on(table.caseId, table.userId),
}));

export const caseCsat = pgTable('case_csat', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id).unique(),
  rating:              integer('rating').notNull(),           // 1–5
  comment:             text('comment'),
  submittedAt:         timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 25.3 Team & Assignment Tables

```typescript
export const helpdeskTeam = pgTable('helpdesk_team', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull().unique(),
  displayName:         text('display_name').notNull(),
  description:         text('description'),
  isDefault:           boolean('is_default').notNull().default(false),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const helpdeskTeamMember = pgTable('helpdesk_team_member', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  teamId:              text('team_id').notNull().references(() => helpdeskTeam.id, { onDelete: 'cascade' }),
  userId:              text('user_id').notNull(),              // StaffUser ID
  role:                text('role').notNull().default('agent'), // agent | lead | manager
  maxConcurrentCases:  integer('max_concurrent_cases').notNull().default(25),
  isAvailable:         boolean('is_available').notNull().default(true),
  joinedAt:            timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueTeamUser:      unique().on(table.teamId, table.userId),
  userIdx:             index('htm_user').on(table.userId),
  teamAvailIdx:        index('htm_team_avail').on(table.teamId, table.isAvailable),
}));
```

### 25.4 Routing, Macros, SLA, Automation Tables

```typescript
export const helpdeskRoutingRule = pgTable('helpdesk_routing_rule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  description:         text('description'),
  sortOrder:           integer('sort_order').notNull().default(0),
  isActive:            boolean('is_active').notNull().default(true),
  conditionsJson:      jsonb('conditions_json').notNull().default('[]'),
  assignTeamId:        text('assign_team_id'),
  assignAgentId:       text('assign_agent_id'),
  setPriority:         casePriorityEnum('set_priority'),
  addTags:             text('add_tags').array().notNull().default(sql`'{}'::text[]`),
  setCategory:         text('set_category'),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  activeSortIdx:       index('hrr_active_sort').on(table.isActive, table.sortOrder),
}));

export const helpdeskMacro = pgTable('helpdesk_macro', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  title:               text('title').notNull(),
  body:                text('body').notNull(),
  category:            text('category'),
  setStatus:           caseStatusEnum('set_status'),
  setPriority:         casePriorityEnum('set_priority'),
  addTags:             text('add_tags').array().notNull().default(sql`'{}'::text[]`),
  isActive:            boolean('is_active').notNull().default(true),
  isShared:            boolean('is_shared').notNull().default(true),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  sortOrder:           integer('sort_order').notNull().default(0),
  usageCount:          integer('usage_count').notNull().default(0),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryActiveIdx:   index('hm_cat_active').on(table.category, table.isActive),
  sharedActiveIdx:     index('hm_shared_active').on(table.isShared, table.isActive),
}));

export const helpdeskSlaPolicy = pgTable('helpdesk_sla_policy', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  priority:            casePriorityEnum('priority').notNull().unique(),
  firstResponseMinutes: integer('first_response_minutes').notNull(),
  resolutionMinutes:   integer('resolution_minutes').notNull(),
  businessHoursOnly:   boolean('business_hours_only').notNull().default(true),
  escalateOnBreach:    boolean('escalate_on_breach').notNull().default(true),
  escalateToTeamId:    text('escalate_to_team_id'),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const helpdeskAutomationRule = pgTable('helpdesk_automation_rule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  description:         text('description'),
  triggerEvent:        text('trigger_event').notNull(),
  conditionsJson:      jsonb('conditions_json').notNull().default('[]'),
  actionsJson:         jsonb('actions_json').notNull().default('[]'),
  isActive:            boolean('is_active').notNull().default(true),
  sortOrder:           integer('sort_order').notNull().default(0),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  triggerActiveIdx:    index('har_trigger_active').on(table.triggerEvent, table.isActive),
}));

export const helpdeskSavedView = pgTable('helpdesk_saved_view', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  filtersJson:         jsonb('filters_json').notNull().default('{}'),
  sortBy:              text('sort_by').notNull().default('createdAt'),
  sortOrder:           text('sort_order').notNull().default('desc'),
  isShared:            boolean('is_shared').notNull().default(false),
  isDefault:           boolean('is_default').notNull().default(false),
  createdByUserId:     text('created_by_user_id').notNull(), // StaffUser ID
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdByIdx:        index('hsv_created_by').on(table.createdByUserId),
  sharedIdx:           index('hsv_shared').on(table.isShared),
}));

export const helpdeskEmailConfig = pgTable('helpdesk_email_config', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  fromName:            text('from_name').notNull().default('Twicely Support'),
  replyToPattern:      text('reply_to_pattern').notNull().default('case+{{caseId}}@support.twicely.co'),
  emailUsageKey:       text('email_usage_key').notNull().default('helpdesk-email'),
  emailFooterText:     text('email_footer_text').notNull().default('Reply to this email to update your case. Case reference: {{case_number}}'),
  autoReplyEnabled:    boolean('auto_reply_enabled').notNull().default(true),
  autoReplyTemplateKey: text('auto_reply_template_key').notNull().default('helpdesk.case.auto_reply'),
  inboundAddress:      text('inbound_address').notNull().default('support@twicely.co'),
  inboundEnabled:      boolean('inbound_enabled').notNull().default(true),
  resolvedRetentionDays: integer('resolved_retention_days').notNull().default(365),
  isActive:            boolean('is_active').notNull().default(true),
  updatedByStaffId:    text('updated_by_staff_id'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 25.5 Knowledge Base Tables

```typescript
export const kbCategory = pgTable('kb_category', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  slug:                text('slug').notNull().unique(),
  parentId:            text('parent_id'),
  name:                text('name').notNull(),
  description:         text('description'),
  icon:                text('icon'),
  sortOrder:           integer('sort_order').notNull().default(0),
  isPublished:         boolean('is_published').notNull().default(false),
  audience:            kbAudienceEnum('audience').notNull().default('ALL'),
  metaTitle:           text('meta_title'),
  metaDescription:     text('meta_description'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentIdx:           index('kbc_parent').on(table.parentId),
  publishedAudienceIdx: index('kbc_pub_audience').on(table.isPublished, table.audience),
}));

export const kbArticle = pgTable('kb_article', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  slug:                text('slug').notNull().unique(),
  categoryId:          text('category_id').notNull().references(() => kbCategory.id),
  title:               text('title').notNull(),
  excerpt:             text('excerpt'),
  body:                text('body').notNull(),
  bodyFormat:          kbBodyFormatEnum('body_format').notNull().default('MARKDOWN'),
  status:              kbArticleStatusEnum('status').notNull().default('DRAFT'),
  isPublished:         boolean('is_published').notNull().default(false),
  publishedAt:         timestamp('published_at', { withTimezone: true }),
  audience:            kbAudienceEnum('audience').notNull().default('ALL'),
  sortOrder:           integer('sort_order').notNull().default(0),
  isFeatured:          boolean('is_featured').notNull().default(false),
  isPinned:            boolean('is_pinned').notNull().default(false),
  metaTitle:           text('meta_title'),
  metaDescription:     text('meta_description'),
  canonicalUrl:        text('canonical_url'),
  tags:                text('tags').array().notNull().default(sql`'{}'::text[]`),
  searchKeywords:      text('search_keywords').array().notNull().default(sql`'{}'::text[]`),
  viewCount:           integer('view_count').notNull().default(0),
  helpfulYes:          integer('helpful_yes').notNull().default(0),
  helpfulNo:           integer('helpful_no').notNull().default(0),
  version:             integer('version').notNull().default(1),
  authorStaffId:       text('author_staff_id'),
  lastEditedById:      text('last_edited_by_id'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx:         index('kba_category').on(table.categoryId),
  statusPublishedIdx:  index('kba_status_pub').on(table.status, table.isPublished),
  audiencePublishedIdx: index('kba_audience_pub').on(table.audience, table.isPublished),
  featuredIdx:         index('kba_featured').on(table.isFeatured),
}));

export const kbArticleAttachment = pgTable('kb_article_attachment', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  articleId:           text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  filename:            text('filename').notNull(),
  url:                 text('url').notNull(),
  mimeType:            text('mime_type'),
  sizeBytes:           integer('size_bytes'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleIdx:          index('kbaa_article').on(table.articleId),
}));

export const kbArticleRelation = pgTable('kb_article_relation', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sourceArticleId:     text('source_article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  targetArticleId:     text('target_article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  relationType:        text('relation_type').notNull().default('related'), // related | prerequisite
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueRelation:      unique().on(table.sourceArticleId, table.targetArticleId),
  sourceIdx:           index('kbar_source').on(table.sourceArticleId),
  targetIdx:           index('kbar_target').on(table.targetArticleId),
}));

export const kbCaseArticleLink = pgTable('kb_case_article_link', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),
  articleId:           text('article_id').notNull().references(() => kbArticle.id),
  linkedByStaffId:     text('linked_by_staff_id'),
  linkedAt:            timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
  sentToCustomer:      boolean('sent_to_customer').notNull().default(false),
}, (table) => ({
  uniqueCaseArticle:   unique().on(table.caseId, table.articleId),
  caseIdx:             index('kbcal_case').on(table.caseId),
  articleIdx:          index('kbcal_article').on(table.articleId),
}));

export const kbArticleFeedback = pgTable('kb_article_feedback', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  articleId:           text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  isHelpful:           boolean('is_helpful').notNull(),
  comment:             text('comment'),
  userId:              text('user_id'),
  sessionId:           text('session_id'),
  ipHash:              text('ip_hash'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleIdx:          index('kbaf_article').on(table.articleId),
  articleHelpfulIdx:   index('kbaf_article_helpful').on(table.articleId, table.isHelpful),
}));
```

---

## 26. Background Jobs

| Job | Queue | Schedule | Description |
|-----|-------|----------|-------------|
| `helpdesk.autoClose` | helpdesk | Every 15 min | Close PENDING_USER cases past threshold, close RESOLVED cases past window |
| `helpdesk.slaCheck` | helpdesk | Every 5 min | Calculate SLA countdowns, trigger warnings and breaches |
| `helpdesk.csatSend` | helpdesk | Every 5 min | Send CSAT surveys for newly resolved cases (after delay) |
| `helpdesk.inboundEmail` | helpdesk | Webhook-triggered | Process inbound email → create/update case |
| `helpdesk.outboundEmail` | helpdesk | On agent reply | Send outbound email, track delivery |
| `kb.reindex` | search | On article publish/unpublish | Update Typesense index for KB articles |
| `kb.viewCount` | analytics | Every 5 min | Batch update article view counts |

---

## 27. V2 → V3 Translation Notes

| V2 | V3 | Reason |
|----|----|--------|
| SupportTicket + HelpdeskCase (dual models) | helpdeskCase (single model) | V2 had legacy SupportTicket from early build and added HelpdeskCase later. V3 consolidates. |
| SupportMacro + HelpdeskMacro | helpdeskMacro (single model) | Same consolidation. |
| Case type `SUPPORT` (generic) | Split into `SUPPORT`, `ORDER`, `BILLING`, `ACCOUNT` | Better routing and reporting. |
| No CSAT | caseCsat table | New in V3. |
| assignedAgent stores userId | assignedAgentId stores StaffUser ID | V3 uses StaffUser for all platform staff. |
| No macro usage tracking | usageCount on helpdeskMacro | New in V3. Better analytics. |
| KBBodyFormat.RICHTEXT unused | Still defined but editor TBD | Decision deferred. |

---
---

## 28. Case Merge

### 28.1 Problem

Buyers email AND submit a web form about the same issue. Sellers file a case, then their buyer files a separate case about the same order. Duplicate cases waste agent time and risk contradictory responses.

### 28.2 Merge Rules

- Any agent can merge two cases. Source case merges INTO target case.
- Source case status → CLOSED with event: "Merged into {targetCaseNumber}"
- All messages from source case copied into target case timeline (preserving original timestamps, marked with "From merged case {sourceCaseNumber}")
- All events from source case copied into target case timeline
- All watchers from source case added to target case
- All commerce links from source case added to target case (union, not replacement)
- All tags from source case added to target case
- CSAT from source case discarded (only target case collects CSAT)
- Source case gets a permanent redirect: any URL or email reply to source case routes to target case
- Merge is irreversible. No un-merge.

### 28.3 Merge Restrictions

- Cannot merge a CLOSED case as the target (source can be any status)
- Cannot merge a case into itself
- Cannot merge if cases have different requesters UNLESS agent confirms ("These cases have different requesters — merge anyway?")
- Cannot chain-merge (if A was already merged into B, you can't merge B into C — close B manually first)
- Max 5 source cases merged into a single target (prevents mega-cases)

### 28.4 UI

Merge button on case detail toolbar (next to Escalate). Flow:

1. Agent clicks Merge → search modal appears
2. Agent searches by case number, requester email, or subject
3. Results show case number, subject, requester, status
4. Agent selects target case → confirmation dialog showing both cases side-by-side
5. "Merge {source} into {target}" button → executes merge
6. Agent redirected to target case

### 28.5 Schema Addition

Add to `caseEvent` eventType values: `merged_from`, `merged_into`

Add to `helpdeskCase`:
```typescript
  // Merge tracking
  mergedIntoCaseId:    text('merged_into_case_id'),  // If this case was merged into another
```

Add index:
```typescript
  mergedIntoIdx:       index('hdc_merged_into').on(table.mergedIntoCaseId),
```

---

## 29. Agent Collision Detection

### 29.1 Problem

Two agents open the same case. Both start typing replies. One sends first — the other doesn't know, sends a duplicate or contradictory response. Zendesk solves this with presence indicators. We have Centrifugo — we should too.

### 29.2 Implementation

Uses existing `private-case.{caseId}` Centrifugo channel.

**Presence events:**

| Event | Payload | Trigger |
|-------|---------|---------|
| `agent_viewing` | `{agentId, agentName, since}` | Agent opens case detail page |
| `agent_left` | `{agentId}` | Agent navigates away or closes tab |
| `agent_typing_reply` | `{agentId, agentName, isInternal}` | Agent starts typing in compose area |
| `agent_stopped_typing` | `{agentId}` | 3 seconds of no keystrokes or agent clears compose |
| `agent_sent_reply` | `{agentId, messageId}` | Agent sends message — all other agents see it instantly |

**UI indicators:**

- **Top of case detail:** "Sarah is also viewing this case" — avatar + name, subtle gray bar
- **Compose area:** "Sarah is typing a reply..." — yellow warning bar above compose, appears when another agent is actively composing
- **Multiple agents:** "Sarah and Mike are viewing this case" — stacks up to 3, then "+2 others"

**Conflict prevention:**
- If Agent A sends a reply while Agent B has the compose area open, Agent B sees a toast: "Sarah just sent a reply — review before sending yours"
- The new message appears in the timeline immediately (real-time via Centrifugo)
- Agent B can then decide to discard their draft or send it as additional context

### 29.3 Presence Timeout

- `agent_viewing` automatically expires after 5 minutes of no mouse/keyboard activity on the case page
- Heartbeat ping every 60 seconds while agent has the case open
- Browser `beforeunload` sends `agent_left`

### 29.4 No Schema Changes

All presence data is ephemeral via Centrifugo presence API. No database tables needed.

---

## 30. System Case Templates

### 30.1 Problem

When a chargeback webhook or dispute escalation auto-creates a case, the description is generic or empty. The agent has to manually piece together what happened by reading the context panel. A pre-populated description with structured context saves the first 30-60 seconds of every system-created case.

### 30.2 Templates by Case Type

**CHARGEBACK (from Stripe webhook):**
```
⚠️ CHARGEBACK FILED

Order: {{orderNumber}}
Amount: ${{disputeAmountFormatted}}
Stripe Reason: {{stripeDisputeReason}}
Chargeback Filed: {{disputeCreatedAt}}
Evidence Due By: {{evidenceDueDate}}

Buyer: {{buyerName}} ({{buyerEmail}})
Seller: {{sellerStoreName}} ({{sellerEmail}})

Item: {{listingTitle}}
Tracking: {{trackingNumber}} — {{trackingStatus}}

Action Required: Gather evidence and respond via Stripe before the deadline.
```

**DISPUTE (buyer protection claim, seller no-response):**
```
🛡️ BUYER PROTECTION CLAIM — AUTO-ESCALATED

Claim Type: {{claimType}}
Order: {{orderNumber}}
Amount: ${{orderTotalFormatted}}

Buyer: {{buyerName}} — filed on {{claimFiledDate}}
Seller: {{sellerStoreName}} — DID NOT RESPOND within 3 business days

Buyer's Description: {{claimDescription}}
Evidence: {{evidencePhotoCount}} photos attached

Seller Trust Score: {{sellerTrustScore}} ({{sellerPerformanceBand}})
Buyer Trust Signals: {{buyerCompletedPurchases}} purchases · {{buyerReturns90d}} returns (90d) · {{buyerDisputes90d}} disputes (90d)

Platform must decide within 48 hours.
```

**RETURN (escalated — buyer rejects seller decline):**
```
🔄 RETURN ESCALATED

Order: {{orderNumber}}
Return Reason: {{returnReason}}
Return Requested: {{returnRequestedDate}}

Seller declined on {{sellerDeclinedDate}}.
Seller's reason: "{{sellerDeclineReason}}"

Buyer disagrees and has escalated to Twicely.

Buyer Evidence: {{buyerEvidenceCount}} photos
Seller Evidence: {{sellerEvidenceCount}} photos

Seller return policy: {{sellerReturnPolicy}}
```

**MODERATION (flagged message):**
```
🚩 MESSAGE FLAGGED

Conversation: {{conversationLink}}
Between: {{party1Name}} and {{party2Name}}
Re: {{listingTitle}}

Flagged Message: "{{flaggedMessagePreview}}"
Flag Reason: {{flagReason}}
Flagged By: {{flaggedByName}} on {{flaggedDate}}

Detection: {{detectionType}} (user_report | auto_scan)
```

**MODERATION (reported listing):**
```
🚩 LISTING REPORTED

Listing: {{listingTitle}} (${{priceCentsFormatted}})
Seller: {{sellerStoreName}}
Report Reason: {{reportReason}}
Reported By: {{reporterName}} on {{reportDate}}

Listing Status: {{listingStatus}}
Listing Created: {{listingCreatedDate}}
Total Reports on This Listing: {{totalReports}}
```

**SYSTEM (fraud detection):**
```
🔍 FRAUD SIGNAL DETECTED

Pattern: {{fraudPatternName}}
Confidence: {{confidenceLevel}}
Affected User: {{userName}} ({{userEmail}})

Details: {{fraudDescription}}

Recommended Action: {{recommendedAction}}
```

### 30.3 Template Storage

Templates stored in `platformSetting` under category `helpdesk.templates`:

| Key | Type | Description |
|-----|------|-------------|
| `helpdesk.templates.chargeback` | string | Chargeback case description template |
| `helpdesk.templates.dispute` | string | Dispute escalation template |
| `helpdesk.templates.return` | string | Return escalation template |
| `helpdesk.templates.moderation.message` | string | Flagged message template |
| `helpdesk.templates.moderation.listing` | string | Reported listing template |
| `helpdesk.templates.fraud` | string | Fraud detection template |

Editable by HELPDESK_MANAGER at `/hd/settings` under a "Case Templates" tab. Variables use `{{mustache}}` syntax. Invalid variables render as empty string.

### 30.4 Template Rendering

When a system case is created, the case creation service:

1. Loads the template from `platformSetting` (with cache)
2. Resolves all `{{variables}}` by fetching linked commerce entities
3. Sets the rendered output as the case `description`
4. Agent sees the pre-populated description when they open the case — no manual context assembly needed
---
**END OF HELPDESK CANONICAL**
**Vocabulary: CaseType (not TicketType), CaseStatus (not TicketStatus), casePriority (not ticketPriority), HELPDESK_AGENT/LEAD/MANAGER (not SUPPORT_AGENT).**
**Route prefix: `/hd/*` on hub.twicely.co. Help center: `/h/*` on twicely.co.**
