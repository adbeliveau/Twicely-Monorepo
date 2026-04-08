# TWICELY V3 — Actors, Permissions & Security Canonical
**Version:** v2.0  
**Status:** LOCKED  
**Date:** 2026-02-15  
**Purpose:** Unified document defining every actor, permission, delegation scope, route gate, and security requirement. Combines V2's Phase 0 Actors + Security Audit into one canonical source.

This document has two parts:
- **Part A (Sections 1-8):** WHO can do WHAT — actors, CASL permissions, delegation, route maps
- **Part B (Sections 9-26):** HOW we protect everything — security requirements, compliance, threat model

---

## 0. Why This Document Comes First

In V2, RBAC was defined across 4 separate files and implemented in Phase 1 as a backend concern. The result: permissions were architecturally correct but disconnected from actual user flows. Pages existed that nobody had permission to reach. Buttons rendered that did nothing because the role check was missing.

In V3, we define actors before pages, permissions before routes, and boundaries before code. Every route, every button, every API call traces back to a row in this document.

**Rule: If an action is not in this matrix, it does not exist in V3.**

---

## 1. Actor Definitions

### 1.1 Actor Types

V3 has exactly **6 actor types**. No more, no less.

| # | Actor | Identity | Session Type | Description |
|---|-------|----------|-------------|-------------|
| 1 | **Guest** | Anonymous | Cookie/session ID | Unauthenticated visitor browsing the marketplace |
| 2 | **Buyer** | Authenticated user | JWT session | Registered user who purchases items |
| 3 | **Seller** | Authenticated user + seller profile | JWT session + seller context | User who lists and sells items (every seller is also a buyer) |
| 4 | **Seller Staff** | Authenticated user + delegated access | JWT session + delegation context | Person granted scoped access to a seller's account |
| 5 | **Platform Agent** | Authenticated staff | JWT session + platform role | Twicely employee (support, moderation, finance, helpdesk) |
| 6 | **Platform Admin** | Authenticated staff | JWT session + admin role | Twicely administrator with elevated privileges |

### 1.2 Actor Lifecycle

```
Guest → (sign up) → Buyer → (enable selling) → Seller
                                                   ↓
                                              (invite staff) → Seller Staff

Platform Agent ← (hired + provisioned by Admin)
Platform Admin ← (granted by existing Admin, 2FA required)
```

### 1.3 Critical Invariants

- **Unified user model.** There is ONE user table. A user can be a buyer, seller, or both. There are no separate account types.
- **Seller is a capability, not an account type.** Any buyer can enable selling. Enabling selling creates a SellerProfile linked to their user.
- **Seller Staff are not sellers.** They act on behalf of a seller within scoped permissions. They cannot sell under their own identity through delegation.
- **Platform roles are separate from marketplace roles.** A Twicely employee can also have a personal buyer/seller account, but platform permissions never leak into marketplace context and vice versa.
- **Single-owner principle.** Every listing, order, payout, and store has exactly one ownerUserId. Delegation grants access, never ownership.

---

## 2. Permission Architecture

### 2.1 Three Permission Layers

V3 uses exactly three permission layers. They never overlap.

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Route-Level Access (middleware)        │
│  WHO can reach this page/endpoint at all?        │
│  Enforced: Next.js middleware + CASL             │
├─────────────────────────────────────────────────┤
│  Layer 2: Resource-Level Access (service)        │
│  CAN this actor see/modify THIS resource?        │
│  Enforced: Service layer + CASL abilities        │
├─────────────────────────────────────────────────┤
│  Layer 3: Field-Level Access (response)          │
│  WHICH fields can this actor see/edit?           │
│  Enforced: Response serializers + CASL fields    │
└─────────────────────────────────────────────────┘
```

### 2.2 CASL Ability Definitions

V3 replaces V2's string-based permission checks with CASL's subject/action model.

**Actions (verbs):**

| Action | Meaning |
|--------|---------|
| `read` | View/list the resource |
| `create` | Create a new instance |
| `update` | Modify existing instance |
| `delete` | Remove (soft-delete) |
| `manage` | All actions (admin shorthand) |

**Subjects (nouns — one per domain):**

| Subject | Domain | Examples |
|---------|--------|----------|
| `Listing` | Commerce | View, create, edit, end listings |
| `Order` | Commerce | View order, fulfill, cancel |
| `Cart` | Commerce | Add items, checkout |
| `Shipment` | Logistics | Create label, track, mark shipped |
| `Return` | Resolution | Request return, approve, reject |
| `Dispute` | Resolution | Open, escalate, resolve |
| `Payout` | Finance | View, request, hold, execute |
| `LedgerEntry` | Finance | Read-only for all (immutable) |
| `Review` | Trust | Submit, moderate, respond |
| `Message` | Communication | Send, read, flag |
| `Conversation` | Communication | Read, create, update (archive) |
| `ListingQuestion` | Marketplace | Ask, answer, hide, pin |
| `HelpdeskCase` | Support | Create, assign, resolve, close |
| `Notification` | Communication | Read, dismiss, configure preferences |
| `User` | Identity | View profile, edit own, admin manage |
| `SellerProfile` | Identity | View, edit, verify, suspend |
| `DelegatedAccess` | Identity | Invite staff, revoke, edit scopes |
| `Subscription` | Billing | View tier, upgrade, downgrade |
| `Promotion` | Marketing | Create coupon, manage campaign |
| `PromotedListing` | Marketing | Enable, set budget, view stats |
| `Category` | Catalog | View, create, edit (admin only) |
| `Policy` | Governance | View, create version, activate |
| `FeatureFlag` | Platform | View, toggle, set rollout |
| `AuditEvent` | Platform | Read-only (immutable) |
| `Setting` | Platform | View, update (admin only) |
| `Analytics` | Intelligence | View dashboards, export |
| `HealthCheck` | Platform | View, run diagnostics |

---

## 3. Actor × Permission Matrix

### 3.1 Guest (Unauthenticated)

**Principle: Guests can browse, search, and view. They cannot act.**

| Subject | read | create | update | delete | Conditions |
|---------|------|--------|--------|--------|------------|
| Listing | ✅ | — | — | — | Only status=ACTIVE, not enforcement-blocked |
| Category | ✅ | — | — | — | Only isActive=true |
| Review | ✅ | — | — | — | Only approved reviews on active listings |
| SellerProfile | ✅ | — | — | — | Public storefront only |
| Cart | ✅ | ✅ | ✅ | ✅ | Session-based cart, merges on login |
| Policy | ✅ | — | — | — | Published policies only |
| All others | — | — | — | — | Redirect to login |

**Guest boundaries:**
- Cannot checkout (must authenticate)
- Cannot message sellers
- Cannot save searches or wishlist (stored in local storage, synced on login)
- Cannot access /seller/*, /corp/*, /helpdesk/*, /account/*

---

### 3.2 Buyer (Authenticated, No Seller Profile)

**Principle: Buyers can purchase, communicate, review, and manage their account.**

| Subject | read | create | update | delete | Conditions |
|---------|------|--------|--------|--------|------------|
| Listing | ✅ | — | — | — | Active + eligible |
| Order | ✅ | ✅ | — | — | Own orders only; "create" = checkout |
| Cart | ✅ | ✅ | ✅ | ✅ | Own cart only |
| Return | ✅ | ✅ | — | — | Own orders only; within return window |
| Dispute | ✅ | ✅ | — | — | Own orders only; after return denied or no response |
| Review | ✅ | ✅ | ✅ | — | Create: completed orders only; Update: own within edit window |
| Message | ✅ | ✅ | — | — | Conversations with sellers on own orders/listings |
| HelpdeskCase | ✅ | ✅ | — | — | Own cases only; create via support portal |
| Notification | ✅ | — | ✅ | — | Own; update = mark read/dismissed |
| User | ✅ | — | ✅ | ✅ | Own profile only; delete = account deletion request |
| Subscription | — | — | — | — | No access (not a seller) |
| Wishlist* | ✅ | ✅ | — | ✅ | Own only |
| SavedSearch* | ✅ | ✅ | ✅ | ✅ | Own only |
| PriceAlert* | ✅ | ✅ | ✅ | ✅ | Own only |
| All platform subjects | — | — | — | — | No access |

*These are buyer-experience subjects, not top-level CASL subjects. They're sub-resources of User.

**Buyer boundaries:**
- Cannot access /seller/* (redirect to "Enable Selling" flow)
- Cannot access /corp/*, /helpdesk/*
- Cannot view other buyers' orders, returns, or disputes
- Cannot message sellers without an order or active listing context

---

### 3.3 Seller (Authenticated + SellerProfile)

**Principle: Sellers inherit ALL buyer permissions plus selling capabilities. Seller permissions are scoped to their own resources.**

| Subject | read | create | update | delete | Conditions |
|---------|------|--------|--------|--------|------------|
| *All Buyer permissions above* | ✅ | ✅ | ✅ | ✅ | Same conditions as Buyer |
| Listing | ✅ | ✅ | ✅ | ✅ | Own listings only; state machine enforced |
| Order (seller side) | ✅ | — | ✅ | — | Orders for own listings; update = fulfill/cancel |
| Shipment | ✅ | ✅ | ✅ | — | Own shipments; create label, mark shipped |
| Return (seller side) | ✅ | — | ✅ | — | Returns on own orders; update = approve/reject |
| Dispute (seller side) | ✅ | — | ✅ | — | Disputes on own orders; update = respond/escalate |
| Payout | ✅ | — | — | — | Own payouts; read-only (platform executes) |
| Review (seller response) | ✅ | ✅ | — | — | Create = respond to review on own listing |
| Message | ✅ | ✅ | — | — | Conversations with buyers on own orders |
| SellerProfile | ✅ | — | ✅ | — | Own profile; edit store branding, policies |
| DelegatedAccess | ✅ | ✅ | ✅ | ✅ | Invite/revoke/edit staff for own store |
| Subscription | ✅ | ✅ | ✅ | — | Own tier; create = subscribe; update = change tier |
| Promotion | ✅ | ✅ | ✅ | ✅ | Own promotions; seller-level coupons |
| PromotedListing | ✅ | ✅ | ✅ | ✅ | Own promoted listings; set budget |
| Analytics (seller) | ✅ | — | — | — | Own store analytics only |

**Seller boundaries:**
- Cannot access other sellers' data (hard boundary)
- Cannot modify payout amounts or schedule (platform-controlled)
- Cannot override trust scores or enforcement state
- Cannot access /corp/*, /helpdesk/*
- Payout execution requires: SellerProfile.status=ACTIVE + payoutsEnabled + verified destination + no active holds

---

### 3.4 Seller Staff (Delegated Access)

**Principle: Seller Staff can only do what their delegation scopes allow, and ONLY within the delegating seller's context.**

**Delegation Scopes (V3 — aligned with V2, simplified):**

| Scope Key | Grants Access To |
|-----------|-----------------|
| `dashboard.view` | Seller dashboard overview |
| `listings.view` | View listings |
| `listings.manage` | Create, edit, end listings |
| `orders.view` | View orders |
| `orders.manage` | Fulfill, cancel orders |
| `shipping.manage` | Create labels, mark shipped |
| `returns.respond` | Approve/reject returns |
| `messages.view` | Read conversations |
| `messages.send` | Reply to conversations |
| `finance.view` | View payouts, balance, ledger |
| `analytics.view` | View store analytics |
| `promotions.view` | View promotions |
| `promotions.manage` | Create/edit promotions |
| `settings.view` | View store settings |
| `settings.manage` | Edit store settings |
| `staff.manage` | Invite/revoke/edit other staff (OWNER default only) |

**Role Presets:**

| Preset | Scopes Included |
|--------|----------------|
| OWNER | All scopes (implicit, not stored) |
| MANAGER | All except staff.manage |
| FULFILLMENT | dashboard.view, orders.view, orders.manage, shipping.manage, messages.view, messages.send |
| FINANCE | dashboard.view, finance.view, orders.view, analytics.view |
| SUPPORT | dashboard.view, orders.view, returns.respond, messages.view, messages.send |
| READ_ONLY | dashboard.view, listings.view, orders.view, finance.view, analytics.view, messages.view, settings.view |

**Staff invariants:**
- Staff CANNOT grant scopes they don't have
- Staff CANNOT access data outside the delegating seller's scope
- Staff CANNOT modify owner identity, payout destination, or subscription tiers (StoreTier, ListerTier)
- Staff actions are logged with `actorUserId` + `onBehalfOfSellerId`
- Staff sessions show "Acting as: [Store Name]" in UI at all times
- If delegation is revoked mid-session, next API call returns 403

---

### 3.5 Platform Agent (Helpdesk Agent, Support, Moderation)

**Principle: Platform Agents handle customer issues, moderate content, and enforce policy. They cannot configure the platform or execute financial operations.**

**Platform Agent Roles:**

| Role | Primary Function | Route Access |
|------|-----------------|--------------|
| `HELPDESK_AGENT` | Customer support cases | /helpdesk/* |
| `HELPDESK_LEAD` | Manage macros, views, assign cases | /helpdesk/* |
| `HELPDESK_MANAGER` | Teams, routing, SLA, automation | /helpdesk/*, /corp/helpdesk-settings/* |
| `SUPPORT` | User support tools, disputes, guided refunds | /corp/support/* |
| `MODERATION` | Content review, listing takedowns, bans | /corp/moderation/* |
| `FINANCE` | Payout review, ledger, reconciliation (read-heavy) | /corp/finance/* |
| `DEVELOPER` | Diagnostics, logs, feature flags (no financial writes) | /corp/developer/* |
| `SRE` | Health checks, system status, provider monitoring | /corp/health/* |

**Agent permissions matrix (key actions):**

| Action | HELPDESK | SUPPORT | MODERATION | FINANCE | DEVELOPER | SRE |
|--------|----------|---------|------------|---------|-----------|-----|
| View any user | ✅ | ✅ | ✅ | ✅ | — | — |
| View any order | ✅ | ✅ | — | ✅ | — | — |
| View any listing | ✅ | ✅ | ✅ | — | — | — |
| Issue guided refund | — | ✅ | — | — | — | — |
| Suppress listing | — | — | ✅ | — | — | — |
| Suspend seller | — | — | ✅ | — | — | — |
| View ledger | — | — | — | ✅ | — | — |
| Execute payout | — | — | — | — | — | — |
| Place/release hold | — | — | — | ✅ | — | — |
| Toggle feature flag | — | — | — | — | ✅ | — |
| View audit logs | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Run health checks | — | — | — | — | ✅ | ✅ |
| Manage providers | — | — | — | — | — | ✅ |

**Agent boundaries:**
- Agents CANNOT create listings, place orders, or act as marketplace participants through their staff account
- Agents CANNOT execute payouts (requires ADMIN)
- Agents CANNOT modify RBAC roles or grant permissions (requires ADMIN)
- Agents CANNOT access raw database or encryption keys
- All agent actions on user data create AuditEvent records
- Agent sessions timeout after 30 minutes of inactivity

---

### 3.6 Platform Admin

**Principle: Admins configure the platform, manage staff, execute financial operations, and are the final authority. Admin actions require enhanced authentication.**

**Admin has `manage` on ALL subjects**, plus these exclusive capabilities:

| Exclusive Admin Action | 2FA Required | Audit Level |
|----------------------|--------------|-------------|
| Grant/revoke Admin role | ✅ | CRITICAL |
| Execute payouts | ✅ | CRITICAL |
| Change payout destinations (override) | ✅ | CRITICAL |
| Modify fee schedules | ✅ | HIGH |
| Modify trust thresholds | ✅ | HIGH |
| Create/deactivate platform agent accounts | ✅ | HIGH |
| Activate/deactivate modules | ✅ | HIGH |
| Configure providers (API keys) | ✅ | CRITICAL |
| Force-refund (override dispute) | ✅ | CRITICAL |
| Purge user data (GDPR) | ✅ | CRITICAL |
| Modify subscription tier pricing (Store + Lister) | ✅ | HIGH |
| Enable/disable marketplace-wide features | — | MEDIUM |
| View/export analytics | — | LOW |
| Manage categories | — | MEDIUM |
| Manage policy library | — | MEDIUM |
| Manage notification templates | — | LOW |

**Admin boundaries:**
- Admin CANNOT bypass state machines (e.g., cannot set an order to "delivered" without shipping confirmation)
- Admin CANNOT edit ledger entries (immutable, append-only)
- Admin CANNOT delete audit events
- Admin actions are logged with enhanced metadata (IP, device, session ID)
- First Admin is created during bootstrap; subsequent Admins require existing Admin + 2FA

---

## 4. Auth Implementation (Better Auth + CASL)

### 4.1 Session Structure

```typescript
type Session = {
  userId: string;
  email: string;
  name: string;
  
  // Marketplace identity
  isSeller: boolean;
  sellerId: string | null;       // null if not a seller
  sellerStatus: SellerStatus | null;
  
  // Delegation (populated when staff is acting for a seller)
  delegationId: string | null;
  onBehalfOfSellerId: string | null;
  delegatedScopes: string[];
  
  // Platform staff (populated for Twicely employees)
  isPlatformStaff: boolean;
  platformRoles: PlatformRole[];
  
  // Security
  mfaVerified: boolean;
  lastActivity: Date;
};
```

### 4.2 CASL Ability Factory

```typescript
// Pseudocode — actual implementation in V3 auth module
function defineAbilitiesFor(session: Session) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  // === GUEST (no session) ===
  // Handled by middleware — public routes only

  // === BUYER (authenticated, no seller) ===
  if (session.userId) {
    can('read', 'Listing', { status: 'ACTIVE' });
    can('read', 'Category', { isActive: true });
    can('read', 'Review', { status: 'APPROVED' });
    can('manage', 'Cart', { userId: session.userId });
    can('read', 'Order', { buyerId: session.userId });
    can('create', 'Order'); // checkout
    can('create', 'Return', { buyerId: session.userId });
    can('create', 'Dispute', { buyerId: session.userId });
    can('create', 'Review', { buyerId: session.userId });
    can('manage', 'Notification', { userId: session.userId });
    can('manage', 'User', { id: session.userId });
    can('create', 'HelpdeskCase');
    can('read', 'HelpdeskCase', { requesterId: session.userId });
    can(['read', 'create'], 'Message', { participantId: session.userId });
  }

  // === SELLER (has seller profile) ===
  if (session.isSeller && session.sellerId) {
    can('manage', 'Listing', { ownerUserId: session.userId });
    can('read', 'Order', { sellerId: session.sellerId });
    can('update', 'Order', { sellerId: session.sellerId }); // fulfill/cancel
    can('manage', 'Shipment', { sellerId: session.sellerId });
    can('update', 'Return', { sellerId: session.sellerId }); // approve/reject
    can('update', 'Dispute', { sellerId: session.sellerId }); // respond
    can('read', 'Payout', { sellerId: session.sellerId });
    can('manage', 'SellerProfile', { userId: session.userId });
    can('manage', 'DelegatedAccess', { sellerId: session.sellerId });
    can('manage', 'Subscription', { sellerId: session.sellerId });
    can('manage', 'Promotion', { sellerId: session.sellerId });
    can('manage', 'PromotedListing', { sellerId: session.sellerId });
    can('read', 'Analytics', { sellerId: session.sellerId });
  }

  // === SELLER STAFF (delegated) ===
  if (session.delegationId && session.onBehalfOfSellerId) {
    const scopes = session.delegatedScopes;
    const sid = session.onBehalfOfSellerId;
    
    if (scopes.includes('listings.view')) can('read', 'Listing', { sellerId: sid });
    if (scopes.includes('listings.manage')) {
      can(['create', 'update', 'delete'], 'Listing', { sellerId: sid });
    }
    if (scopes.includes('orders.view')) can('read', 'Order', { sellerId: sid });
    if (scopes.includes('orders.manage')) can('update', 'Order', { sellerId: sid });
    if (scopes.includes('shipping.manage')) can('manage', 'Shipment', { sellerId: sid });
    if (scopes.includes('returns.respond')) can('update', 'Return', { sellerId: sid });
    if (scopes.includes('messages.view')) can('read', 'Message', { sellerId: sid });
    if (scopes.includes('messages.send')) can('create', 'Message', { sellerId: sid });
    if (scopes.includes('finance.view')) can('read', 'Payout', { sellerId: sid });
    if (scopes.includes('analytics.view')) can('read', 'Analytics', { sellerId: sid });
    if (scopes.includes('promotions.view')) can('read', 'Promotion', { sellerId: sid });
    if (scopes.includes('promotions.manage')) can('manage', 'Promotion', { sellerId: sid });
    if (scopes.includes('settings.view')) can('read', 'SellerProfile', { sellerId: sid });
    if (scopes.includes('settings.manage')) can('update', 'SellerProfile', { sellerId: sid });
    if (scopes.includes('staff.manage')) can('manage', 'DelegatedAccess', { sellerId: sid });
    
    // Staff can NEVER do these regardless of scopes
    cannot('manage', 'Subscription');
    cannot('manage', 'Payout');
    cannot('delete', 'SellerProfile');
  }

  // === PLATFORM AGENTS ===
  if (session.isPlatformStaff) {
    for (const role of session.platformRoles) {
      switch (role) {
        case 'HELPDESK_AGENT':
        case 'HELPDESK_LEAD':
        case 'HELPDESK_MANAGER':
          can('manage', 'HelpdeskCase');
          can('read', ['User', 'Order', 'Listing', 'Return', 'Dispute']);
          break;
        case 'SUPPORT':
          can('read', ['User', 'Order', 'Listing', 'Return', 'Dispute', 'Payout', 'AuditEvent']);
          can('create', 'Return'); // guided refund initiation
          break;
        case 'MODERATION':
          can('read', ['User', 'Listing', 'Review', 'Message', 'AuditEvent']);
          can('update', 'Listing', { field: 'enforcementState' });
          can('update', 'SellerProfile', { field: 'status' }); // suspend
          can('update', 'Review', { field: 'status' }); // moderate
          break;
        case 'FINANCE':
          can('read', ['Order', 'Payout', 'LedgerEntry', 'AuditEvent', 'User']);
          can('update', 'Payout', { field: 'holdStatus' }); // place/release hold
          break;
        case 'DEVELOPER':
          can('read', ['FeatureFlag', 'AuditEvent', 'HealthCheck']);
          can('update', 'FeatureFlag');
          break;
        case 'SRE':
          can('read', ['HealthCheck', 'AuditEvent']);
          can('manage', 'HealthCheck'); // run diagnostics
          break;
      }
    }
  }

  // === PLATFORM ADMIN ===
  if (session.platformRoles?.includes('ADMIN')) {
    can('manage', 'all');
    // Even admin cannot:
    cannot('delete', 'LedgerEntry');  // immutable
    cannot('delete', 'AuditEvent');   // immutable
    cannot('update', 'LedgerEntry');  // immutable
  }

  return build();
}
```
---
### 4.3 Custom Roles

#### 4.3.1 Architecture

V3 uses a hybrid permission model: 10 system roles are defined in code + unlimited custom roles are defined in the database. Both feed into the same CASL ability factory.

System roles: permissions hardcoded in the ability factory. Cannot be edited, deleted, or renamed. The toggle grid on the role detail page is read-only for system roles.

Custom roles: permissions stored as JSON in the `customRole.permissionsJson` column. Editable via the toggle grid UI. Changes take effect on the staff user's next request — no deploy needed.

#### 4.3.2 Permission JSON Format
```typescript
// customRole.permissionsJson
[
  { "subject": "Order", "action": "read" },
  { "subject": "Order", "action": "update" },
  { "subject": "ReturnRequest", "action": "read" },
  { "subject": "ReturnRequest", "action": "update" },
  { "subject": "ReturnRequest", "action": "process" },
  { "subject": "User", "action": "read" }
]
```

Each entry maps to a single `can()` call in the ability factory.

#### 4.3.3 Ability Factory Integration
```typescript
function defineAbilitiesFor(session: StaffSession) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  // Step 1: Load system role permissions (from code)
  for (const role of session.platformRoles) {
    applySystemRolePermissions(can, cannot, role);
  }

  // Step 2: Load custom role permissions (from database)
  for (const customRole of session.customRoles) {
    for (const perm of customRole.permissions) {
      can(perm.action, perm.subject);
    }
  }

  // Step 3: Apply hard ceilings (custom roles can never exceed these)
  cannot('manage', 'CustomRole');        // Only SUPER_ADMIN via system role
  cannot('manage', 'StaffUser');         // Only ADMIN+ via system role
  cannot('delete', 'AuditEvent');        // Nobody, ever
  cannot('update', 'LedgerEntry');       // Nobody, ever
  cannot('delete', 'LedgerEntry');       // Nobody, ever

  return build();
}
```

System role permissions are applied first. Custom role permissions are additive — they can only grant additional access, never revoke system role access. Hard ceilings are applied last and override everything, preventing privilege escalation through custom roles.

#### 4.3.4 Permission Subjects & Actions

The toggle grid UI organizes permissions into subjects (rows) and actions (columns). These are the available subjects and their valid actions:

| Subject | Actions | Notes |
|---------|---------|-------|
| User | view, create, edit, delete, impersonate, warn, restrict, message | Impersonate = read-only dashboard preview |
| Role | view, create, edit, delete | System roles: view only |
| Staff | view, create, edit, delete | Platform staff accounts |
| Listing | view, create, edit, delete, moderate | Moderate = flag/remove/suppress |
| Catalog | view, create, edit, delete | Categories + attribute schemas |
| Order | view, create, edit, delete | Create = admin-initiated order (rare) |
| Seller | view, create, edit, delete | Seller profiles + verification |
| Category | view, create, edit, delete | Product taxonomy |
| Payment | view, create, edit, delete | Payment intents + captures |
| Ledger | view, create, edit, delete | Create = manual adjustment. Edit/delete always blocked. |
| Finance | view, create, edit, delete | Finance dashboards + reports |
| Payout | view, create, edit, delete, execute | Execute = trigger payout batch (2FA) |
| Hold | view, create, edit, delete | Reserve holds on seller funds |
| Reconciliation | view, create, edit, delete | Create = trigger manual recon |
| Chargeback | view, create, edit, delete | Chargeback case management |
| Dispute | view, create, edit, delete | Buyer protection disputes |
| Return | view, create, edit, delete, process | Process = approve/decline/override |
| TrustSafety | view, create, edit, delete, settings | Settings = trust thresholds |
| Review | view, create, edit, delete, moderate | Moderate = remove/approve flagged |
| Notification | view, create, edit, delete | Templates + delivery |
| HelpdeskCase | view, create, edit, delete, assign, escalate | Helpdesk case operations |
| HelpdeskConfig | view, create, edit, delete | Teams, routing, SLA, macros |
| KBArticle | view, create, edit, delete, publish | Publish = move to PUBLISHED |
| PlatformSetting | view, edit | Platform configuration |
| FeatureFlag | view, create, edit, delete | Feature flag management |
| AuditEvent | view | Read-only, always. Never create/edit/delete. |
| SystemHealth | view | Monitoring dashboards |
| Subscription | view, edit | Tier management + pricing |
| Promotion | view, create, edit, delete | Platform-level promotions |
| DataRetention | view, edit | GDPR + retention policies |

Total: **30 subjects, ~130 distinct permissions.**

#### 4.3.5 Guardrails

- Only SUPER_ADMIN can create, edit, or delete custom roles. 2FA required. Audit severity: CRITICAL.
- Maximum **20 custom roles** total. Prevents permission sprawl.
- Custom roles cannot grant any permission that exceeds ADMIN-level access. The hard ceilings in the ability factory enforce this.
- Custom role names must be unique, 3-50 characters, alphanumeric + spaces.
- Custom role codes are auto-generated from names: "Returns Specialist" → `RETURNS_SPECIALIST`.
- Deleting a custom role strips it from all assigned staff but does not deactivate their accounts. Those staff keep any system roles they have.
- Every custom role creation, edit, assignment, and deletion is audit logged with full before/after diff.
- A staff user can have multiple system roles AND multiple custom roles. Permissions are unioned (additive).

#### 4.3.6 UI Behavior

**Role list page (`/roles`):**
- Grid of role cards (same layout as V2)
- System roles: "System" badge. "Locked" badge on SUPER_ADMIN.
- Custom roles: "Custom" badge. Edit button.
- "New Role" button visible only to SUPER_ADMIN.

**Role detail (system role):**
- Display name, code, description — read-only
- Toggle grid — all toggles disabled/grayed, showing current permissions
- "Staff with this role" list

**Role detail (custom role, viewed by SUPER_ADMIN):**
- Display name, description — editable
- Code — read-only (auto-generated)
- Toggle grid — toggles are interactive, purple when enabled (same as V2)
- Hard-ceiling permissions shown as permanently disabled toggles with tooltip: "This permission is restricted to system roles"
- Save button — writes `permissionsJson` to database, takes effect immediately
- Delete button — confirmation dialog listing affected staff
- "Staff with this role" list with assign/revoke

**Role detail (custom role, viewed by non-SUPER_ADMIN):**
- Everything read-only, same as system role view
---

## 5. Route Protection Map

### 5.1 Public Routes (Guest + All)

| Route Pattern | Page | Notes |
|---------------|------|-------|
| `/` | Home / landing | Public browse |
| `/search` | Search results | Public |
| `/c/[category]` | Category browse | Public |
| `/listing/[id]` | Listing detail | Active listings only |
| `/seller/[slug]` | Seller storefront (public) | Public profile |
| `/policies/[slug]` | Policy pages | Published policies |
| `/auth/login` | Login | Redirect if authenticated |
| `/auth/signup` | Registration | Redirect if authenticated |
| `/auth/forgot-password` | Password reset | Public |
| `/auth/verify-email` | Email verification | Token-gated |

### 5.2 Buyer Routes (Authenticated)

| Route Pattern | Page | Min Auth |
|---------------|------|----------|
| `/account` | Account overview | Authenticated |
| `/account/profile` | Edit profile | Authenticated |
| `/account/addresses` | Saved addresses | Authenticated |
| `/account/notifications` | Notification preferences | Authenticated |
| `/account/security` | Password, 2FA | Authenticated |
| `/account/privacy` | Privacy, data export | Authenticated |
| `/orders` | My orders | Authenticated |
| `/orders/[id]` | Order detail | Own order |
| `/orders/[id]/return` | Request return | Own order, within window |
| `/orders/[id]/dispute` | Open dispute | Own order, eligible |
| `/cart` | Shopping cart | Authenticated |
| `/checkout` | Checkout flow | Authenticated, cart not empty |
| `/messages` | Conversations | Authenticated |
| `/messages/[id]` | Conversation detail | Own conversation |
| `/wishlist` | Saved items | Authenticated |
| `/alerts` | Price & category alerts | Authenticated |
| `/support` | Help center | Authenticated |
| `/support/cases` | My support cases | Authenticated |
| `/support/cases/[id]` | Case detail | Own case |
| `/support/new` | Submit support case | Authenticated |

### 5.3 Seller Routes (Authenticated + Seller Profile)

| Route Pattern | Page | Min Scope |
|---------------|------|-----------|
| `/seller` | Seller dashboard | `dashboard.view` |
| `/seller/listings` | Listings manager | `listings.view` |
| `/seller/listings/new` | Create listing | `listings.manage` |
| `/seller/listings/[id]/edit` | Edit listing | `listings.manage` + own |
| `/seller/orders` | Seller orders | `orders.view` |
| `/seller/orders/[id]` | Order detail (seller) | `orders.view` + own |
| `/seller/orders/[id]/ship` | Ship order | `orders.manage` + own |
| `/seller/shipping` | Shipping profiles | `shipping.manage` |
| `/seller/returns` | Return requests | `returns.respond` |
| `/seller/returns/[id]` | Return detail | `returns.respond` + own |
| `/seller/messages` | Seller messages | `messages.view` |
| `/seller/payouts` | Payout history | `finance.view` |
| `/seller/analytics` | Store analytics | `analytics.view` |
| `/seller/promotions` | Seller promotions | `promotions.view` |
| `/seller/promotions/new` | Create promotion | `promotions.manage` |
| `/seller/promoted-listings` | Promoted listings | `promotions.manage` |
| `/seller/bundles` | Bundle manager | `listings.manage` |
| `/seller/store` | Store settings | `settings.view` |
| `/seller/store/edit` | Edit store | `settings.manage` |
| `/seller/subscription` | Subscription/tier | Owner only |
| `/seller/staff` | Staff management | `staff.manage` |
| `/seller/onboarding` | Seller onboarding | Owner only |
| `/seller/verification` | Verification status | Owner only |

### 5.4 Helpdesk Routes (Platform Agent: HELPDESK_*)

| Route Pattern | Page | Min Role |
|---------------|------|----------|
| `/helpdesk` | Case queue | HELPDESK_AGENT |
| `/helpdesk/cases/[id]` | Case detail + context | HELPDESK_AGENT |
| `/helpdesk/views` | Saved views | HELPDESK_AGENT |
| `/helpdesk/macros` | Macro library | HELPDESK_LEAD |
| `/helpdesk/teams` | Team management | HELPDESK_MANAGER |
| `/helpdesk/routing` | Routing rules | HELPDESK_MANAGER |
| `/helpdesk/sla` | SLA policies | HELPDESK_MANAGER |
| `/helpdesk/automation` | Automation rules | HELPDESK_MANAGER |
| `/helpdesk/reports` | Helpdesk analytics | HELPDESK_LEAD |

### 5.5 Corp Admin Routes (Platform Staff)

| Route Pattern | Page | Min Role |
|---------------|------|----------|
| `/corp` | Admin dashboard | Any platform role |
| `/corp/users` | User management | ADMIN, SUPPORT |
| `/corp/users/[id]` | User detail | ADMIN, SUPPORT |
| `/corp/roles` | Role management | ADMIN |
| `/corp/listings` | Listing admin | ADMIN, MODERATION |
| `/corp/orders` | Order admin | ADMIN, SUPPORT, FINANCE |
| `/corp/orders/[id]` | Order detail (admin) | ADMIN, SUPPORT, FINANCE |
| `/corp/disputes` | Dispute queue | ADMIN, SUPPORT |
| `/corp/returns` | Return admin | ADMIN, SUPPORT |
| `/corp/moderation` | Moderation queue | ADMIN, MODERATION |
| `/corp/finance/ledger` | Ledger viewer | ADMIN, FINANCE |
| `/corp/finance/payouts` | Payout admin | ADMIN, FINANCE |
| `/corp/finance/reconciliation` | Reconciliation | ADMIN, FINANCE |
| `/corp/trust` | Trust settings | ADMIN |
| `/corp/policies` | Policy library | ADMIN |
| `/corp/categories` | Category management | ADMIN |
| `/corp/notifications` | Notification admin | ADMIN |
| `/corp/notifications/templates` | Template editor | ADMIN |
| `/corp/promotions` | Platform promotions | ADMIN |
| `/corp/subscriptions` | Subscription tiers | ADMIN |
| `/corp/analytics` | Platform analytics | ADMIN, FINANCE |
| `/corp/settings` | Platform settings | ADMIN |
| `/corp/settings/integrations` | Provider management | ADMIN, SRE |
| `/corp/settings/fees` | Fee configuration | ADMIN |
| `/corp/settings/trust` | Trust thresholds | ADMIN |
| `/corp/feature-flags` | Feature flags | ADMIN, DEVELOPER |
| `/corp/audit` | Audit log viewer | ADMIN, SUPPORT, MODERATION, FINANCE, DEVELOPER, SRE |
| `/corp/health` | System health | ADMIN, DEVELOPER, SRE |
| `/corp/health/doctor` | Doctor checks | ADMIN, DEVELOPER, SRE |
| `/corp/modules` | Module management | ADMIN |
| `/corp/data-retention` | Privacy & retention | ADMIN |

---

## 6. Security Enforcement Rules

### 6.1 Authentication Requirements

| Action Category | Password | 2FA | Session Max Age |
|----------------|----------|-----|-----------------|
| Browse / read | — | — | — |
| Buyer actions | ✅ | — | 24 hours (Decision #142, was 7 days) |
| Seller actions | ✅ | — | 24 hours (Decision #142, was 7 days) |
| Seller financial (payouts, subscription) | ✅ | Recommended | 24 hours |
| Staff delegation changes | ✅ | Recommended | 24 hours |
| Platform agent actions | ✅ | ✅ | 8 hours |
| Platform admin actions | ✅ | ✅ | 4 hours |
| Admin critical actions | ✅ | ✅ (re-verify) | Per-action |

### 6.2 Rate Limits (Per Actor Type)

| Actor | Action | Limit |
|-------|--------|-------|
| Guest | Search | 60/min |
| Guest | Page views | 120/min |
| Buyer | API calls | 120/min |
| Buyer | Order creation | 10/hour |
| Buyer | Message sends | 30/hour |
| Seller | Listing creation | 100/hour |
| Seller | API calls | 300/min |
| Staff | Delegation invites | 10/day |
| Agent | API calls | 600/min |
| Admin | No limit | — |

### 6.3 Audit Requirements

| Severity | What Gets Audited | Retention |
|----------|-------------------|-----------|
| CRITICAL | Role grants, payout execution, provider config, data purge, force-refund | 7 years |
| HIGH | Fee changes, trust changes, staff account management, seller suspension | 3 years |
| MEDIUM | Listing moderation, dispute resolution, category changes | 2 years |
| LOW | Login, profile updates, notification preference changes | 1 year |
| NONE | Search queries, page views, cart updates | Not audited |

---


---

# PART B: SECURITY REQUIREMENTS

The following sections cover every security surface. Requirements are classified:
- 🔴 **BETA BLOCKER** — Must be implemented before any real user touches the platform
- 🟡 **POST-BETA** — Within 30 days of beta launch
- 🟢 **GROWTH PHASE** — Implement as platform scales

---

## 1. Authentication Security

### 1.1 Password Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| Minimum 10 characters | Better Auth config + client validation |
| Breach database check | Check against HaveIBeenPwned API on registration and password change |
| Argon2id hashing | Better Auth default — verify it's not using bcrypt |
| No password max length below 128 chars | Prevent truncation attacks |
| Rate limit login attempts | 5 failed attempts → 15 min lockout → exponential backoff |
| Account lockout notification | Email user on 3+ failed attempts from unknown IP |
| Password change requires current password | Prevent session-riding password changes |
| Password reset tokens expire in 1 hour | Single-use, cryptographically random, 256-bit minimum |
| Password reset doesn't confirm email existence | Return same message whether email exists or not |

### 1.2 Session Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| HTTP-only cookies | `httpOnly: true` — JS cannot read session token |
| Secure flag | `secure: true` — cookies only sent over HTTPS |
| SameSite=Lax | Prevent CSRF while allowing normal navigation |
| Session rotation on privilege change | New session ID on login, role change, 2FA verification |
| Concurrent session limit | Max 5 active sessions per user, show active sessions in settings |
| Session revocation | User can kill individual sessions from /account/security |
| Absolute session timeout | Buyer/Seller: **24 hours** (per Decision #142, was 7 days), Agent: 8 hours, Admin: 4 hours |
| Idle timeout | Agent: 30 min, Admin: 15 min (re-auth required) |
| Session binding | Bind to user-agent + IP range (warn on change, don't auto-kill) |
| Logout invalidates server-side | Session deleted from database, not just cookie cleared |

### 1.3 Multi-Factor Authentication 🔴

| Requirement | Implementation |
|-------------|---------------|
| TOTP support (Google Auth, Authy) | Better Auth TOTP plugin |
| Recovery codes | 10 single-use codes generated at 2FA setup, stored hashed |
| 2FA required for platform staff | Enforced at role assignment — cannot have ADMIN/SUPPORT/etc without 2FA |
| 2FA recommended for sellers with >$1K balance | Prompted, not forced |
| 2FA re-verification for critical actions | Payout execution, role grants, provider config, Super Admin actions |
| Backup method | Email-based OTP as fallback (not SMS — SIM swap vulnerable) |
| 2FA bypass lockout | If recovery codes exhausted, manual identity verification by support |

### 1.4 Account Takeover Prevention 🔴

| Requirement | Implementation |
|-------------|---------------|
| Login from new device/location → email notification | Always, cannot be disabled |
| Impossible travel detection | Login from NYC then Tokyo within 1 hour → flag + require 2FA |
| Credential stuffing protection | Rate limit by IP (not just by account) — 20 attempts/min per IP |
| Account recovery requires identity proof | Email + last 4 of phone or answer to security question |
| Email change requires password + 2FA + 24hr delay | Notification sent to old email with cancel link |
| Phone change requires password + 2FA | Immediate notification to old phone (if SMS enabled) |

### 1.5 OAuth / API Consumer Security 🟡

| Requirement | Implementation |
|-------------|---------------|
| OAuth 2.0 Authorization Code flow with PKCE | No implicit grant |
| Client secrets stored hashed | Never exposed after initial creation |
| Scope validation on every request | API consumer cannot exceed granted scopes |
| Token rotation | Refresh tokens single-use, rotate on each use |
| Access token lifetime: 1 hour | Refresh token lifetime: 30 days |
| Rate limits per OAuth app | Separate from user rate limits |
| App review before public listing | Manual approval by Admin for marketplace app directory |

---

## 2. Authorization Security

### 2.1 CASL Enforcement 🔴

| Requirement | Implementation |
|-------------|---------------|
| Default deny | If no CASL rule matches, action is FORBIDDEN |
| Ability check on every API route | Middleware wrapper — no route can skip check |
| Ability check on every server component | `ability.can()` before any data fetch |
| Resource conditions checked against actual data | Not just role check — ownership verified against DB record |
| `cannot()` rules are immutable | Staff cannot() for payouts/subscriptions is hardcoded, not configurable |
| No client-side-only permission checks | Client CASL is for UI gating only — server always re-verifies |
| CASL subjects are typed enum | TypeScript prevents inventing new subjects |

### 2.2 IDOR Prevention 🔴

| Requirement | Implementation |
|-------------|---------------|
| Every resource access checks ownership | `where: { id, ownerUserId: session.userId }` pattern |
| Use CUID2 for all IDs | Non-sequential, non-guessable |
| Never expose internal IDs in error messages | "Not found" not "You don't have access to order X" |
| Seller staff can only access delegating seller's data | `sellerId` condition on every CASL rule |
| Platform agent access is scoped by role | FINANCE cannot see moderation data, MODERATION cannot see finance data |

### 2.3 Privilege Escalation Prevention 🔴

| Requirement | Implementation |
|-------------|---------------|
| Role assignment requires higher privilege | Admin cannot grant Super Admin, only Super Admin can |
| Self-privilege escalation blocked | User cannot modify own roles |
| Delegation cannot exceed delegator's scopes | Staff cannot grant scopes they don't have |
| Platform role changes require Super Admin approval | Approval workflow from Phase 0 |
| Hidden admin routes not accessible by URL manipulation | Middleware checks role before rendering, not just hiding nav items |
| API routes validate role independently of UI | Even if someone crafts a direct API call |

### 2.4 Mass Assignment Prevention 🔴

| Requirement | Implementation |
|-------------|---------------|
| Zod schemas on every API input | Strict mode — unknown keys rejected |
| Never spread request body into database update | Explicit field mapping only |
| `role`, `status`, `ownerUserId` never settable from client | Server-only fields excluded from all input schemas |
| `sellerId`, `delegationId` derived from session | Never from request body |
| Webhook payloads validated against Stripe signature | Never trust unsigned webhook data |

---

## 3. Payment & Financial Security

### 3.1 PCI Compliance 🔴

| Requirement | Implementation |
|-------------|---------------|
| Never store card numbers | Stripe Elements/Payment Element handles all card data |
| Never log card data | Request logging must exclude payment fields |
| Stripe.js loaded from Stripe CDN | Never self-hosted |
| PaymentIntent created server-side only | Client never sets amount |
| TLS 1.2+ on all connections | HSTS enforced |
| PCI SAQ-A compliance | Document and maintain |

### 3.2 Payout Fraud Prevention 🔴

| Requirement | Implementation |
|-------------|---------------|
| Payout destination changes require 2FA + 72hr hold | Prevents attacker draining account after takeover |
| Payout minimum hold period | 7 days from sale to payout eligibility (configurable) |
| Velocity check on payouts | Flag if >3 payout requests in 24 hours |
| Payout destination verification | Stripe Connect handles this, but log verification status |
| Manual review for first payout >$500 | Admin must approve |
| Payout freeze on account compromise | Automatic hold if password changed + payout requested within 24hrs |
| All payout executions logged as CRITICAL audit | Who, when, amount, destination |

### 3.3 Refund & Chargeback Fraud 🔴

| Requirement | Implementation |
|-------------|---------------|
| Refund cannot exceed original payment | Server validates refund amount ≤ order total |
| Partial refund tracking | Sum of all partial refunds ≤ order total |
| Duplicate refund prevention | Idempotency key on refund requests |
| Chargeback dispute evidence collection | Automated evidence package (order details, tracking, messages) |
| Serial returner detection | Flag buyers with >20% return rate |
| Friendly fraud indicators | Delivered + return denied + chargeback = flag buyer |
| Refund-then-relist detection | Seller refunds buyer then relists same item = flag |

### 3.4 Money Laundering Indicators 🟡

| Requirement | Implementation |
|-------------|---------------|
| Rapid buy/sell between same parties | Flag accounts trading with each other repeatedly |
| Price anomalies | Item listed at 10x category average = review |
| Sudden volume spike | New seller with 50 orders in first day = review |
| Cross-account payout patterns | Multiple seller accounts paying to same bank = flag |
| Structuring detection | Multiple transactions just under review thresholds |

### 3.5 Ledger Integrity 🔴

| Requirement | Implementation |
|-------------|---------------|
| Ledger entries are append-only | No UPDATE or DELETE on ledger table |
| Database trigger prevents ledger mutation | Not just application code — DB-level enforcement |
| Fee calculations use snapshot at order time | FeeSchedule.effectiveAt checked, never current schedule |
| Double-entry principle | Every credit has corresponding debit(s) |
| Daily reconciliation job | Sum of ledger vs Stripe balance, flag variance |
| Reconciliation is read-only | Recon job NEVER mutates ledger |

---

## 4. Data Protection & Privacy

### 4.1 Encryption 🔴

| Requirement | Implementation |
|-------------|---------------|
| TLS 1.2+ everywhere | HTTPS enforced on all routes, HSTS header |
| Database connections encrypted | `sslmode=require` on PostgreSQL |
| Sensitive fields encrypted at rest | Payout destinations, API keys, OAuth secrets |
| Encryption keys in secrets manager | Not in .env, not in code |
| Cloudflare R2 server-side encryption | AES-256 for stored images |
| Valkey connections encrypted | TLS between app and Valkey |
| BullMQ job payloads don't contain PII | Pass entity IDs, not user data |

### 4.2 PII Handling 🔴

| Requirement | Implementation |
|-------------|---------------|
| PII inventory maintained | Document every field that contains PII |
| PII never logged | Request/response logging must scrub email, name, address, phone |
| PII in search index is minimal | Typesense contains listing data, not buyer PII |
| PII access requires audit trail | Every time an agent views a user's profile, it's logged |
| PII display is masked | Phone: ***-***-1234, Email: a***@email.com in admin views |
| SSN/Tax ID never stored in Twicely | Stripe Connect handles KYC — we store verification status only |

### 4.3 GDPR Compliance 🔴

| Requirement | Implementation |
|-------------|---------------|
| Right to access (data export) | User can request full data export from /account/privacy |
| Right to erasure (deletion) | 24hr cooling period → pseudonymize audit logs → delete user data |
| Right to rectification | User can edit their profile data |
| Data processing consent | Clear consent at signup, granular consent for marketing |
| Data retention schedule | Enforced automatically per severity level |
| Data Processing Agreement | For all third-party services (Stripe, Cloudflare R2, email provider) |
| Privacy policy accessible | Public /policies/privacy route |
| Cookie consent | Only if using non-essential cookies |
| Breach notification | 72-hour GDPR notification process documented |

### 4.4 CCPA Compliance 🟡

| Requirement | Implementation |
|-------------|---------------|
| "Do Not Sell My Personal Information" link | Footer link, functional opt-out |
| Right to know what data is collected | Data inventory accessible to user |
| Right to delete | Same as GDPR erasure flow |
| Non-discrimination | Users who exercise rights don't get degraded service |

---

## 5. API Security

### 5.1 Input Validation 🔴

| Requirement | Implementation |
|-------------|---------------|
| Zod validation on every API route | No unvalidated inputs, ever |
| String length limits | Title: 200, Description: 10000, Message: 5000, etc. |
| Numeric range validation | Price: 1-99999999 cents, Quantity: 1-10000 |
| Enum validation | Status fields only accept valid enum values |
| URL validation | Only HTTPS URLs accepted in user inputs |
| HTML sanitization | DOMPurify on any field rendered as HTML |
| SQL injection prevention | Drizzle ORM parameterized queries (never raw SQL from user input) |
| NoSQL injection prevention | Typesense query sanitization |
| Path traversal prevention | Filename sanitization on all uploads |
| Request body size limit | 1MB default, 50MB for image uploads |

### 5.2 Rate Limiting 🔴

| Requirement | Implementation |
|-------------|---------------|
| Global rate limit | 1000 req/min per IP |
| Per-route rate limiting | Login: 5/min, Signup: 3/min, Search: 60/min, API: varies by actor |
| Valkey-backed sliding window | Not in-memory (survives restart) |
| Rate limit headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| Graceful 429 response | JSON error with `retryAfter` field |
| Separate limits per actor type | Guest: 60/min, Buyer: 120/min, Seller: 300/min, Admin: unlimited |
| Expensive operation limits | Image upload: 20/hour, Listing creation: 100/hour, Checkout: 10/hour |
| Distributed rate limiting | Valkey cluster if multi-instance deployment |

### 5.3 CSRF Protection 🔴

| Requirement | Implementation |
|-------------|---------------|
| SameSite=Lax on all cookies | Prevents cross-origin cookie sending |
| CSRF token on state-changing forms | Double-submit cookie or signed token |
| Origin/Referer header validation | Reject requests from unexpected origins |
| Custom header requirement for API | `X-Requested-With` or auth header required |

### 5.4 CORS Policy 🔴

| Requirement | Implementation |
|-------------|---------------|
| Strict origin whitelist | Only allow `twicely.com` and `*.twicely.com` |
| No wildcard (`*`) in production | Never `Access-Control-Allow-Origin: *` |
| Credentials mode explicit | `Access-Control-Allow-Credentials: true` only for whitelisted origins |
| Preflight caching | `Access-Control-Max-Age: 86400` |
| No sensitive data in CORS-accessible routes | Public API routes return minimal data |

### 5.5 Security Headers 🔴

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Content-Security-Policy` | Strict policy — see Section 5.6 |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (no iframe embedding) |
| `X-XSS-Protection` | `0` (CSP handles this now, header is deprecated) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self)` |
| `X-DNS-Prefetch-Control` | `off` |

### 5.6 Content Security Policy 🔴

```
default-src 'self';
script-src 'self' https://js.stripe.com;
style-src 'self' 'unsafe-inline';
img-src 'self' https://*.r2.cloudflarestorage.com https://images.twicely.co data: blob:;
font-src 'self';
connect-src 'self' https://api.stripe.com wss://ws.twicely.com;
frame-src https://js.stripe.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

Notes:
- `unsafe-inline` for styles is needed for Tailwind — mitigate with nonces if possible
- Stripe requires `js.stripe.com` in script-src and frame-src
- Centrifugo WebSocket needs `wss://` in connect-src
- Cloudflare R2 image serving domain in img-src (use custom domain or R2 public bucket URL)

---

## 6. Marketplace-Specific Threats

### 6.1 Fake Listing Fraud 🔴

| Requirement | Implementation |
|-------------|---------------|
| Image uniqueness check | Perceptual hash on upload — flag if identical to existing listing by different seller |
| Price anomaly detection | Flag listings >50% below category average |
| New seller listing velocity limit | Max 10 listings in first 24 hours |
| Listing content moderation | Automated keyword scanning for prohibited items |
| External URL detection | Flag descriptions containing links to off-platform sales |
| Copy detection | Flag if listing description is identical to another seller's listing |

### 6.2 Shill Buying/Review Manipulation 🟡

| Requirement | Implementation |
|-------------|---------------|
| Self-purchase prevention | Buyer cannot purchase own listings (hard block) |
| Related account detection | Flag accounts sharing IP, device fingerprint, or payment method |
| Review pattern analysis | Flag if same buyer reviews same seller >3 times in 30 days |
| Review velocity check | Flag sellers receiving >10 reviews in 24 hours |
| Incentivized review detection | NLP scan for "seller asked me to" / "discount for review" patterns |

### 6.3 Account Farming 🔴

| Requirement | Implementation |
|-------------|---------------|
| Email verification required before selling | Cannot create listing without verified email |
| Phone verification for Store subscription | Required for Store STARTER+ |
| Device fingerprinting | Flag if >3 accounts from same browser fingerprint |
| IP-based registration throttle | Max 3 accounts per IP per 24 hours |
| Disposable email detection | Block known disposable email domains |

### 6.4 Messaging Abuse 🔴

| Requirement | Implementation |
|-------------|---------------|
| Off-platform transaction prevention | Detect and warn on phone numbers, emails, external URLs in messages |
| Spam detection | Rate limit messages: 30/hour, flag if identical content sent to >5 sellers |
| Phishing link detection | URL scanning in messages — block known phishing domains |
| Automated message flagging | Keywords: "pay outside", "Venmo", "cash app", "wire transfer" |
| Message reporting | Buyer and seller can flag messages → moderation queue |
| Block user function | Blocked user cannot message or purchase from blocker |

### 6.5 Seller Impersonation 🔴

| Requirement | Implementation |
|-------------|---------------|
| Store name uniqueness | No two sellers with identical store names |
| Confusable name detection | Flag "Tw1cely Official" or "Twicely-Store" as impersonation attempts |
| Verified seller badge | Only after identity verification — cannot be self-claimed |
| Logo/branding moderation | Flag if seller uses Twicely's own branding |

### 6.6 Prohibited Items 🔴

| Requirement | Implementation |
|-------------|---------------|
| Keyword-based listing screening | Block list for prohibited items (weapons, drugs, counterfeit) |
| Category-specific rules | Enforce listing requirements per category |
| Image-based detection | Future: AI image classification for prohibited items |
| Reporting mechanism | "Report this listing" button on every listing page |
| Rapid takedown process | Reported → moderation queue → 24hr response SLA |

---

## 7. Real-Time (WebSocket) Security

### 7.1 Centrifugo Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| Authentication on connect | Session token validated before WebSocket handshake |
| Channel authorization | Private channels require server-side auth check |
| Presence channels scoped to authorized users | Seller can only see who's in their own store |
| Message size limit | Max 10KB per WebSocket message |
| Connection rate limit | Max 5 connections per user |
| Connection timeout | Idle connections closed after 5 minutes |
| No sensitive data in WebSocket payloads | Send event type + entity ID, client fetches details via API |
| Channel naming convention | `private-user.{userId}`, `private-order.{orderId}` — validated server-side |
| Reconnection backoff | Exponential backoff on reconnect to prevent thundering herd |

### 7.2 Subscription Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| User can only subscribe to own channels | `private-user.123` only subscribable by user 123 |
| Seller staff gets seller's channels | Based on delegation, not arbitrary subscription |
| Admin channels require platform role | `private-admin.*` requires authenticated platform staff |
| Unsubscribe on permission revocation | If delegation revoked, WebSocket channels immediately closed |

---

## 8. Image & File Upload Security

### 8.1 Upload Validation 🔴

| Requirement | Implementation |
|-------------|---------------|
| File type validation by magic bytes | Don't trust file extension — read first bytes to verify JPEG/PNG/WebP/GIF |
| Maximum file size: 20MB | Enforced server-side, not just client |
| Maximum dimensions: 8000x8000 | Prevent image bombs |
| Minimum dimensions: 200x200 | Quality requirement |
| Maximum files per listing: 12 | Enforced in API |
| Image decompression bomb protection | Check compressed vs decompressed size ratio |
| SVG not accepted | SVG can contain JavaScript — block entirely |
| EXIF data stripping | Remove all metadata including GPS coordinates |
| Filename sanitization | Replace with UUID — never use original filename in storage path |
| Path traversal prevention | Reject filenames containing `..`, `/`, `\` |
| Virus scanning | ClamAV on upload queue (async, quarantine until scanned) |

### 8.2 Storage Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| R2 bucket access: private | No public listing of bucket contents |
| Signed URLs for image access | Time-limited (1 hour) signed URLs, or CDN with token |
| Separate buckets per purpose | `listings/`, `avatars/`, `helpdesk-attachments/` |
| No execution permissions | R2 bucket policy: read only, no execute |
| Image processing in isolated worker | Sharp runs in BullMQ job, not in request handler |

---

## 9. Search Security

### 9.1 Typesense Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| Admin API key never exposed to client | Separate search-only API key for client |
| Query length limit | Max 500 characters |
| Filter injection prevention | Sanitize filter values, whitelist allowed filter keys |
| No PII in search index | Only listing data, seller display name — no emails, phones, addresses |
| Tenant isolation not needed | Single marketplace — all listings in one index |
| Search rate limiting | 60/min for guests, 120/min for authenticated |
| Complex query detection | Flag/block queries with excessive filters (potential DoS) |

---

## 10. Email Security

### 10.1 Email Infrastructure 🔴

| Requirement | Implementation |
|-------------|---------------|
| SPF record | Authorize sending IPs/services |
| DKIM signing | Sign all outbound email |
| DMARC policy | `p=quarantine` minimum, `p=reject` when confident |
| Dedicated sending domain | `mail.twicely.com` not `twicely.com` — protects primary domain |
| Bounce handling | Process bounces, disable email for hard bounces |
| Unsubscribe headers | `List-Unsubscribe` header on all marketing email |
| No user-generated content in email headers | Prevent header injection |

### 10.2 Transactional Email Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| No sensitive data in email body | "You have a new message" not the actual message text |
| Action links use signed tokens | Password reset, email verification links are signed + time-limited |
| No auto-login from email links | Links take to login page if session expired |
| Rate limit email sending per user | Max 10 emails/hour per recipient to prevent abuse |
| Phishing-resistant template design | Clear Twicely branding, no misleading links |

---

## 11. Job Queue Security

### 11.1 BullMQ Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| Valkey connection authenticated | Password-protected Valkey instance |
| Job payloads don't contain secrets | Pass references, not data |
| Failed job data retention limit | Auto-purge failed jobs after 7 days |
| Queue dashboard access restricted | BullMQ UI (if enabled) behind admin auth |
| Poison pill protection | Max retries per job (3), then DLQ |
| Job timeout enforcement | Max execution time per job type (30s default, 5min for image processing) |

---

## 12. Compliance Requirements

### 12.1 FTC Compliance 🔴

| Requirement | Implementation |
|-------------|---------------|
| Promoted listing disclosure | Clear "Sponsored" or "Promoted" label, visible and unambiguous |
| Endorsement disclosure | If reviews are incentivized (future), clear disclosure required |
| Truth in advertising | Listing descriptions must not be misleading |
| Pricing transparency | All fees visible before checkout completion |
| Refund policy visible | Pre-purchase, not just post-purchase |

### 12.2 Consumer Protection 🔴

| Requirement | Implementation |
|-------------|---------------|
| Buyer Protection guarantee page | Public /protection route explaining coverage |
| Clear return/refund policy | Category-specific, visible on listing page |
| Dispute resolution process documented | Accessible from help center |
| Seller contact information | Business sellers must display business info |
| Order confirmation email | Required for every purchase |

### 12.3 Tax Compliance 🟡

| Requirement | Implementation |
|-------------|---------------|
| Marketplace facilitator tax collection | Twicely collects/remits sales tax in applicable states |
| Tax calculation at checkout | Integrate tax service (TaxJar, Avalara, or Stripe Tax) |
| 1099-K reporting | Report sellers exceeding $600 threshold to IRS |
| Tax-exempt buyer handling | Future — enterprise buyers |

### 12.4 Accessibility (ADA/WCAG) 🔴

| Requirement | Implementation |
|-------------|---------------|
| WCAG 2.1 AA compliance | Baseline for all public-facing pages |
| Keyboard navigation | All interactive elements reachable by keyboard |
| Screen reader compatibility | Semantic HTML, ARIA labels on interactive elements |
| Color contrast ratio 4.5:1 minimum | Text and interactive elements |
| Focus indicators | Visible focus ring on all interactive elements |
| Alt text on images | Required for listing images, decorative images marked |
| Form error identification | Clear error messages associated with form fields |
| No seizure-inducing content | No flashing content >3 per second |
| axe-core automated testing | Run on every Storybook component |

### 12.5 COPPA Compliance 🔴

| Requirement | Implementation |
|-------------|---------------|
| Minimum age requirement: 18 | Terms of service, age gate at registration |
| No knowingly collecting data from children | If detected, delete account |
| Age verification for sellers | Required during seller onboarding |

---

## 13. Monitoring & Incident Response

### 13.1 Security Event Logging 🔴

| Event | Severity | Alert |
|-------|----------|-------|
| Failed login (5+ in 1 min) | HIGH | Real-time alert to SRE |
| Password reset request | LOW | Log only |
| 2FA setup/removal | MEDIUM | Email notification to user |
| Role grant/revoke | CRITICAL | Log + Admin notification |
| Payout destination change | CRITICAL | Log + Email + 72hr hold |
| Bulk listing takedown (>10) | HIGH | Admin notification |
| API rate limit exceeded | MEDIUM | Log + temporary block |
| Webhook signature verification failure | HIGH | Alert to SRE |
| CASL permission denial (unexpected) | MEDIUM | Log for analysis |
| New Super Admin granted | CRITICAL | All existing Super Admins notified |
| Database connection failure | CRITICAL | Real-time SRE alert |
| Provider health check failure | HIGH | Real-time SRE alert |
| File upload virus detected | HIGH | Quarantine + alert |
| Concurrent session anomaly (>10) | HIGH | Flag account |

### 13.2 Fraud Detection Patterns 🟡

| Pattern | Detection Method | Action |
|---------|-----------------|--------|
| Account takeover | Password change + payout request in <24hrs | Auto-hold payouts |
| Shill buying | Same IP/device buyer and seller | Flag both accounts |
| Listing hijack | Listing edited to completely different item after reviews | Flag for review |
| Drop shipping abuse | Seller never ships from own address, always different origin | Monitor, no auto-action |
| Return fraud | Buyer returns different item than purchased | Weight in buyer trust score |
| Chargeback abuse | >2 chargebacks in 90 days from same buyer | Restrict buyer's account |
| Velocity abuse | New account creating >50 listings in first hour | Temporary listing block |

### 13.3 Incident Response 🔴

| Requirement | Implementation |
|-------------|---------------|
| Incident response plan documented | Runbook with escalation matrix |
| Breach notification within 72 hours (GDPR) | Pre-drafted notification templates |
| User notification for data breach | Email template ready, process documented |
| Evidence preservation procedures | Read-only audit logs, immutable ledger |
| Post-incident review process | Template for post-mortem documentation |
| Security contact published | security@twicely.com in DNS (security.txt) |
| Vulnerability disclosure program | Responsible disclosure page with safe harbor |

---

## 14. Infrastructure Security

### 14.1 Secrets Management 🔴

| Requirement | Implementation |
|-------------|---------------|
| No secrets in code or .env files | Vercel environment variables or secrets manager |
| Secrets rotated quarterly | Stripe keys, database passwords, R2 access keys |
| Separate secrets per environment | Dev/staging/production never share secrets |
| API keys for providers stored encrypted | Admin UI → encrypted in database, decrypted at runtime |
| Database connection string not in client bundle | Server-only environment variable |
| No secrets in Docker images | Injected at runtime, not build time |

### 14.2 Dependency Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| `npm audit` on every CI build | Fail build on critical vulnerabilities |
| Dependabot or Renovate enabled | Automated PR for dependency updates |
| Lock file committed | `package-lock.json` in version control |
| No `*` version ranges | All dependencies pinned to exact or minor range |
| Subresource Integrity | SRI hashes for any CDN-loaded scripts (Stripe) |
| Supply chain attack monitoring | Monitor for package ownership changes |

### 14.3 Database Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| Least-privilege database user | App connects with restricted user, not superuser |
| No raw SQL from user input | All queries through Drizzle ORM |
| Database backups encrypted | Automated daily backups, encrypted at rest |
| Point-in-time recovery enabled | 7-day PITR window minimum |
| Connection pooling | PgBouncer or built-in pool, max connections configured |
| Audit log table: no UPDATE/DELETE grants | Database-level enforcement, not just app-level |

---

## 15. Emerging Threats (2025-2026)

### 15.1 AI-Generated Content 🟡

| Threat | Mitigation |
|--------|-----------|
| AI-generated fake product images | Perceptual hash database + manual review for flagged listings |
| AI-generated fake reviews | NLP anomaly detection, review velocity checks |
| AI-generated listing descriptions hiding prohibited items | Keyword + context-aware scanning |
| Deepfake seller verification | Require live selfie with random gesture (not just photo upload) |

### 15.2 LLM Prompt Injection 🔴

| Threat | Mitigation |
|--------|-----------|
| Malicious listing descriptions targeting AI search summaries | Sanitize all user content before feeding to any AI model |
| Injection through user names or store names | Treat all user-generated text as untrusted data |
| Prompt injection through helpdesk messages | AI assistant (if used) must not execute actions based on user message content |
| If using AI module: system prompt isolation | User content in separate message, never in system prompt |

### 15.3 Automated Attacks 🔴

| Threat | Mitigation |
|--------|-----------|
| Scraping listing data | Rate limiting + CAPTCHA on suspicious patterns |
| Automated account creation | CAPTCHA on registration, email verification required |
| Price monitoring bots | Rate limit search API, consider robot detection |
| Checkout bots (sniping deals) | Cart reservation prevents instant purchase, CAPTCHA on checkout if suspicious |

---

## 16. V3-Specific Security Additions

These are NEW requirements that weren't in V2 and come from our V3 architecture decisions.

### 16.1 Puck Page Editor Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| Puck output sanitization | Admin-created pages must be sanitized — no script injection |
| Puck component whitelist | Only approved components can be used in pages |
| Preview mode isolation | Puck preview renders in sandboxed iframe |
| Custom CSS restricted | No `@import`, no `url()` pointing to external resources |
| Puck admin access: Admin + Power sellers | Admin for marketing/landing pages; Store Power+ sellers for custom store pages |

### 16.2 Custom AI Module Security 🟡

| Requirement | Implementation |
|-------------|---------------|
| API key for AI provider stored encrypted | Never in client-side code |
| User content isolation | User messages to AI never include other users' data |
| AI response validation | AI cannot execute system actions directly |
| Rate limiting on AI features | 20 requests/hour per user |
| Content moderation on AI output | AI responses screened for harmful content |
| Opt-out available | Users can disable AI features |

### 16.3 Drizzle ORM Security 🔴

| Requirement | Implementation |
|-------------|---------------|
| No `sql.raw()` with user input | Parameterized queries only |
| Transaction isolation level set | `READ COMMITTED` minimum for financial operations |
| Row-level security considered | PostgreSQL RLS as additional defense layer for multi-tenant data (future) |
| Migration files reviewed | No destructive migrations without backup |

### 16.4 Better Auth Hardening 🔴

| Requirement | Implementation |
|-------------|---------------|
| Email enumeration prevention | Login and registration return same error for invalid credentials |
| Account verification required before selling | `emailVerified: true` check before `enableSelling()` |
| Session token entropy | Minimum 256-bit cryptographic random |
| Password reset invalidates old sessions | All sessions killed when password changes |
| Magic link tokens single-use | Token deleted after first use |

---

## 17. Security Testing Requirements

### 17.1 Automated Testing 🔴

| Test Type | Tool | Frequency |
|-----------|------|-----------|
| Dependency vulnerability scan | `npm audit` | Every CI build |
| SAST (Static Analysis) | ESLint security rules + Semgrep | Every CI build |
| OWASP ZAP baseline scan | ZAP Docker | Weekly |
| axe-core accessibility | Storybook integration | Every component |
| CSP validation | csp-evaluator | On CSP changes |
| Header security check | securityheaders.com | Monthly |

### 17.2 Manual Testing 🟡

| Test Type | Frequency | By Whom |
|-----------|-----------|---------|
| Penetration test | Before production launch | External firm |
| IDOR testing | Every new resource endpoint | Developer + reviewer |
| Privilege escalation testing | Every role change | Developer + reviewer |
| Payment flow testing | Every payment change | Developer + QA |

### 17.3 Security Unit Tests 🔴

Every one of these MUST have automated tests:

- CASL abilities: verify every actor type can/cannot perform expected actions
- CASL abilities: verify `cannot()` rules override broader `can()` rules
- Rate limiter: verify limits are enforced per actor type
- Auth: verify session timeout enforcement
- Auth: verify 2FA requirement enforcement for admin actions
- Payments: verify refund cannot exceed order total
- Payments: verify payout gates (all conditions checked)
- Ledger: verify entries are immutable (attempt UPDATE, expect failure)
- Upload: verify file type validation rejects non-images
- Upload: verify EXIF stripping works
- Delegation: verify staff cannot exceed delegator's scopes
- Role approval: verify non-Super-Admin cannot approve role changes

---

## 18. Security Checklist Summary

### 🔴 Beta Blockers (MUST have before any real user)

1. Better Auth configured with Argon2id, session security, 2FA for staff
2. CASL enforcement on every route with default deny
3. Zod validation on every API input
4. Rate limiting on auth routes (login, register, password reset)
5. Security headers (HSTS, CSP, X-Frame-Options, etc.)
6. CORS strict whitelist
7. Image upload validation (magic bytes, size limits, EXIF strip)
8. Stripe integration PCI-compliant (never touch card data)
9. Ledger immutability enforced at database level
10. Payout hold on destination change (72hr)
11. CSRF protection on all state-changing routes
12. No PII in logs
13. Secrets not in code or .env
14. Email verification before selling
15. Self-purchase prevention
16. Off-platform transaction detection in messaging
17. Promoted listing FTC disclosure
18. WCAG 2.1 AA accessibility on all public pages
19. COPPA age gate at registration
20. Password reset doesn't confirm email existence
21. Audit logging on all privileged actions
22. Silent error logging operational
23. Incident response plan documented
24. Security.txt published
25. npm audit passing with no critical vulnerabilities

### 🟡 Post-Beta (within 30 days)

1. OAuth / API consumer security
2. Money laundering indicator detection
3. Shill buying/review manipulation detection
4. Fraud detection pattern monitoring
5. CCPA compliance features
6. AI-generated content detection
7. External penetration test
8. Tax compliance integration
9. Advanced rate limiting (per-route, per-actor)
10. Automated security scanning in CI

### 🟢 Growth Phase

1. Bug bounty / vulnerability disclosure program
2. SOC 2 Type II compliance
3. Advanced fraud ML models
4. Row-level security in PostgreSQL
5. Dedicated security monitoring dashboard
6. Automated incident response playbooks
7. Third-party security audit (annual)

---

## 19. Architecture Impact

These security requirements affect the Phase 0 document in the following ways:

### New routes added:
- `/account/security` — active sessions, 2FA setup, login history
- `/account/security/sessions` — manage active sessions
- `/.well-known/security.txt` — security contact info
- `/policies/privacy` — GDPR/CCPA privacy policy
- `/policies/terms` — terms of service with age gate reference
- `/corp/security` — security event dashboard
- `/corp/security/fraud` — fraud detection queue
- `/corp/security/incidents` — incident management

### New CASL subjects:
- `SecurityEvent` — security log viewing
- `FraudCase` — fraud investigation
- `Incident` — incident management

### New platform roles:
- No new roles needed — ADMIN covers security config, SRE covers monitoring. Fraud investigation falls under MODERATION + SUPPORT.

### New audit events:
- `security.login.failed` (LOW but HIGH if >5 in 1 min)
- `security.session.revoked` (MEDIUM)
- `security.2fa.setup` (MEDIUM)
- `security.2fa.removed` (HIGH)
- `security.payout_destination.changed` (CRITICAL)
- `security.password.changed` (MEDIUM)
- `security.email.changed` (HIGH)
- `security.fraud.flagged` (HIGH)
- `security.incident.created` (CRITICAL)

---

**This document is the security contract for V3. Every item marked 🔴 must be verified before beta. No exceptions.**
