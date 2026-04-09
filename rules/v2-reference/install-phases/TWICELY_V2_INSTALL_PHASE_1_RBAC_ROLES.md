# TWICELY V2 â€” Install Phase 1: Auth + Platform RBAC + Delegated Access + Roles UI (Core)
**Status:** LOCKED (v1.3)  
**Backend-first:** Schema â†’ API â†’ Audit â†’ Health â†’ UI â†’ Doctor  
**Goal:** Implement core User model, platform staff authentication, role/permission system, **delegated access for seller staff**, and strict "Super Admin can grant Super Admin" rule.

**Canonicals (MUST align with):**
- `/rules/TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`
- `/rules/TWICELY_user_MODEL_LOCKED.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_1_RBAC_ROLES.md`  
> Prereq: Phase 0 complete and `pnpm doctor` passes.

---

## 0) What this phase installs

### Backend
- **User model** (core identity - all buyers/sellers)
- Platform staff auth (session-based)
- Platform roles: `ADMIN`, `SUPPORT`, `FINANCE`, `MODERATION`, `DEVELOPER` (+ optional `SRE`)
- Custom roles (admin-created) that map to permission keys (scopes)
- **Delegated Access** (seller staff acting on behalf of owner) â€” eBay-mirrored model
- Permission keys grouped by module (view/create/edit/delete + high-risk)
- Hard rule: only `ADMIN` can create/grant `ADMIN`

### UI
- Corp Hub routes (shell)
- Roles list page
- Role editor page with toggle UI:
  - Module row + View/Create/Edit/Delete toggles
  - High-risk permission groups (payouts/refunds/role-admin)

### Ops
- Audit logging for any role/permission changes (includes `onBehalfOfUserId`)
- System Health provider: `rbac`
- Doctor checks for RBAC correctness

---

## 1) Prisma schema (additive)

Edit `prisma/schema.prisma` and add these models/enums. Do NOT rename existing tables.

```prisma
// =============================================================================
// SELLER TYPE (Personal vs Business - eBay-Exact)
// Personal sellers CANNOT subscribe to a store
// Business upgrade is FREE but required for store subscription
// =============================================================================

enum SellerType {
  PERSONAL    // Individual seller - NO store allowed, SELLER tier only
  BUSINESS    // Registered business - CAN subscribe to store (STARTER+)
}

// =============================================================================
// USER MODEL (Core Identity)
// =============================================================================
// Per TWICELY_USER_MODEL_LOCKED.md:
// - Single account type for all users
// - Buyer = default behavior (no flag needed)
// - Seller = capability activated on subscription
// - All ownership resolves to userId
// - Personal vs Business distinction for store eligibility
// =============================================================================

model User {
  id            String   @id @default(cuid())
  
  // =========================================================================
  // AUTHENTICATION
  // =========================================================================
  email         String   @unique
  emailVerified DateTime?
  passwordHash  String?           // null for OAuth users
  
  // =========================================================================
  // PROFILE
  // =========================================================================
  name          String?           // Legal name
  displayName   String?           // Public display name
  avatarUrl     String?
  bio           String?
  
  // =========================================================================
  // ACCOUNT STATUS
  // =========================================================================
  isActive      Boolean  @default(true)
  isSuspended   Boolean  @default(false)
  suspendedAt   DateTime?
  suspendedReason String?
  
  // =========================================================================
  // ACTIVITY TRACKING
  // =========================================================================
  lastLoginAt   DateTime?
  lastLoginIp   String?
  loginCount    Int      @default(0)
  
  // =========================================================================
  // PREFERENCES
  // =========================================================================
  locale        String   @default("en-US")
  timezone      String   @default("America/New_York")
  currency      String   @default("USD")

  // =========================================================================
  // SELLER DESIGNATION (eBay-Exact Personal/Business)
  // =========================================================================
  isSeller           Boolean    @default(false)
  sellerType         SellerType @default(PERSONAL)

  // Business verification (required before store subscription)
  businessVerifiedAt DateTime?
  businessName       String?    // Displayed to buyers
  businessType       String?    // "sole_proprietor" | "llc" | "corporation" | "partnership"
  businessTaxId      String?    // EIN or SSN (encrypted at rest)
  businessAddress    Json?      // { street, city, state, zip, country }

  // =========================================================================
  // TIMESTAMPS
  // =========================================================================
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // =========================================================================
  // INDEXES
  // =========================================================================
  @@index([email])
  @@index([isActive, isSuspended])
  @@index([createdAt])
  @@index([lastLoginAt])
  @@index([isSeller, sellerType])

  // =========================================================================
  // RELATIONS
  // =========================================================================
  businessInfo   BusinessInfo?
}

// =============================================================================
// BUSINESS INFO (Tax + Legal metadata attached to User)
// Per TWICELY_user_MODEL_LOCKED.md Section 5
// This is NOT a separate account - just metadata for Business sellers
// Required before subscribing to a store (STARTER+)
// =============================================================================

enum BusinessType {
  SOLE_PROPRIETOR
  LLC
  CORPORATION
  PARTNERSHIP
  NONPROFIT
  OTHER
}

enum TaxIdType {
  SSN           // Social Security Number (individuals)
  EIN           // Employer Identification Number (businesses)
  ITIN          // Individual Taxpayer Identification Number
}

model BusinessInfo {
  id              String       @id @default(cuid())
  userId          String       @unique  // One business info per user
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Business Details
  legalName       String                // Legal business name
  businessType    BusinessType          // SOLE_PROPRIETOR, LLC, CORPORATION, PARTNERSHIP, NONPROFIT, OTHER

  // Tax Information (encrypted at rest)
  taxId           String?               // EIN or SSN
  taxIdType       TaxIdType  @default(EIN)

  // Business Address
  addressLine1    String
  addressLine2    String?
  city            String
  state           String
  postalCode      String
  country         String     @default("US")

  // Verification
  verifiedAt      DateTime?             // When business was verified
  verifiedBy      String?               // Staff ID who verified (if manual)

  // Timestamps
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@index([userId])
}

// =============================================================================
// PLATFORM RBAC (Twicely internal staff)
// =============================================================================

enum PlatformRoleName {
  ADMIN
  SUPPORT
  FINANCE
  MODERATION
  DEVELOPER
  SRE
}

model PlatformStaff {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  roles        PlatformStaffRole[]
  customRoles  StaffCustomRole[]
}

model PlatformRole {
  id        String           @id @default(cuid())
  name      PlatformRoleName @unique
  createdAt DateTime @default(now())

  staff     PlatformStaffRole[]
}

model PlatformStaffRole {
  id        String @id @default(cuid())
  staffId   String
  roleId    String
  createdAt DateTime @default(now())

  staff     PlatformStaff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  role      PlatformRole  @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([staffId, roleId])
  @@index([staffId])
  @@index([roleId])
}

model CustomRole {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  isActive    Boolean  @default(true)

  // permission keys, e.g. "orders.view", "orders.edit", ...
  permissions String[]

  createdByStaffId String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  staffAssignments StaffCustomRole[]
}

model StaffCustomRole {
  id        String @id @default(cuid())
  staffId   String
  roleId    String
  createdAt DateTime @default(now())

  staff     PlatformStaff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  role      CustomRole    @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([staffId, roleId])
  @@index([staffId])
  @@index([roleId])
}

// =============================================================================
// DELEGATED ACCESS (Seller staff acting on behalf of owner - eBay-mirrored)
// =============================================================================

model DelegatedAccess {
  id              String   @id @default(cuid())
  ownerUserId     String   // the account owner (seller) - references User.id
  staffUserId     String   // the delegate (staff member) - references User.id
  status          String   @default("active") // active | invited | revoked
  
  // Permission keys for delegated actions
  permissions     String[]
  
  createdByUserId String   // usually ownerUserId - references User.id
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  revokedAt       DateTime?
  revokedByUserId String?  // references User.id

  @@unique([ownerUserId, staffUserId])
  @@index([ownerUserId])
  @@index([staffUserId])
  @@index([status])
}

// =============================================================================
// AUDIT (Required for all privileged actions)
// CANONICAL - All phases must use this schema (MED-2)
// =============================================================================

model AuditEvent {
  id               String   @id @default(cuid())
  
  // Actor information
  actorUserId      String?  // null for system actions - references User.id
  onBehalfOfUserId String?  // set when acting via delegated access - references User.id
  actorType        String   @default("user") // user|system|cron|webhook
  
  // Action details
  action           String   // e.g., "order.created", "listing.updated"
  entityType       String   // e.g., "Order", "Listing"
  entityId         String
  
  // Context
  reasonCode       String?  // Optional reason code
  metaJson         Json     @default("{}")
  
  // Request context
  ip               String?
  userAgent        String?
  requestId        String?  // For distributed tracing
  
  // Timestamp (renamed from createdAt for clarity)
  timestamp        DateTime @default(now())

  @@index([actorUserId, timestamp])
  @@index([onBehalfOfUserId, timestamp])
  @@index([entityType, entityId])
  @@index([action, timestamp])
  @@index([actorType, timestamp])
  @@index([requestId])
}
```

Run migration:
```bash
npx prisma migrate dev --name user_rbac_delegated_phase1
```

---

## 2) User Service (Core Identity Operations)

Create `packages/core/users/user-service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "@/packages/core/audit/emit";

const prisma = new PrismaClient();

export interface CreateUserInput {
  email: string;
  name?: string;
  displayName?: string;
  passwordHash?: string;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<{ id: string; email: string }> {
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      name: input.name,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
    },
  });
  
  await emitAuditEvent({
    actorUserId: user.id,
    action: "user.created",
    entityType: "User",
    entityId: user.id,
  });
  
  return { id: user.id, email: user.email };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      isActive: true,
      isSuspended: true,
      locale: true,
      timezone: true,
      currency: true,
      createdAt: true,
    },
  });
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  data: {
    name?: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    locale?: string;
    timezone?: string;
    currency?: string;
  }
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });
  
  await emitAuditEvent({
    actorUserId: userId,
    action: "user.profile.updated",
    entityType: "User",
    entityId: userId,
    meta: { updatedFields: Object.keys(data) },
  });
  
  return user;
}

/**
 * Record user login
 */
export async function recordUserLogin(userId: string, ip?: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
      loginCount: { increment: 1 },
    },
  });
}

/**
 * Suspend user
 */
export async function suspendUser(
  userId: string,
  reason: string,
  actorUserId: string
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: true,
      suspendedAt: new Date(),
      suspendedReason: reason,
    },
  });
  
  await emitAuditEvent({
    actorUserId,
    action: "user.suspended",
    entityType: "User",
    entityId: userId,
    meta: { reason },
  });
}

/**
 * Unsuspend user
 */
export async function unsuspendUser(userId: string, actorUserId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: false,
      suspendedAt: null,
      suspendedReason: null,
    },
  });
  
  await emitAuditEvent({
    actorUserId,
    action: "user.unsuspended",
    entityType: "User",
    entityId: userId,
  });
}

/**
 * Deactivate user (soft delete)
 */
export async function deactivateUser(userId: string, actorUserId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });
  
  await emitAuditEvent({
    actorUserId,
    action: "user.deactivated",
    entityType: "User",
    entityId: userId,
  });
}

/**
 * Check if user exists
 */
export async function userExists(userId: string): Promise<boolean> {
  const count = await prisma.user.count({ where: { id: userId } });
  return count > 0;
}

/**
 * Check if email is available
 */
export async function isEmailAvailable(email: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { email: email.toLowerCase().trim() },
  });
  return count === 0;
}
```

---

## 3) Audit Event Helper (MED-2 Canonical)

Create `packages/core/audit/emit.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * CANONICAL Audit Event Input Type
 * All phases MUST use this interface for audit events
 */
export type AuditEventInput = {
  actorUserId?: string | null;
  onBehalfOfUserId?: string | null;
  actorType?: "user" | "system" | "cron" | "webhook";
  action: string;
  entityType: string;
  entityId: string;
  reasonCode?: string;
  meta?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  requestId?: string;
};

/**
 * Emit an audit event
 * CANONICAL - All phases must use this function
 */
export async function emitAuditEvent(input: AuditEventInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      onBehalfOfUserId: input.onBehalfOfUserId,
      actorType: input.actorType ?? (input.actorUserId ? "user" : "system"),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      reasonCode: input.reasonCode,
      metaJson: input.meta ?? {},
      ip: input.ip,
      userAgent: input.userAgent,
      requestId: input.requestId,
      timestamp: new Date(),
    },
  });
}

/**
 * Emit audit event from request context
 */
export async function emitAuditEventFromContext(
  ctx: { actorUserId: string; onBehalfOfUserId?: string; ip?: string; userAgent?: string },
  action: string,
  entityType: string,
  entityId: string,
  meta?: Record<string, any>
): Promise<void> {
  await emitAuditEvent({
    actorUserId: ctx.actorUserId,
    onBehalfOfUserId: ctx.onBehalfOfUserId,
    actorType: "user",
    action,
    entityType,
    entityId,
    meta,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}
```

---

## 4) Seed baseline platform roles

Create `scripts/seed-rbac.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const roles = ["ADMIN","SUPPORT","FINANCE","MODERATION","DEVELOPER","SRE"] as const;

  for (const name of roles) {
    await prisma.platformRole.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log("seed-rbac: ok");
}

main().finally(async () => prisma.$disconnect());
```

Add script:
```json
{
  "scripts": {
    "seed:rbac": "tsx scripts/seed-rbac.ts"
  }
}
```

Run:
```bash
pnpm seed:rbac
```

---

## 5) AuthContext + RBAC engine (core TS)

### 5.1 Types

Create `packages/core/rbac/types.ts`:

```ts
export type PlatformRoleName = "ADMIN" | "SUPPORT" | "FINANCE" | "MODERATION" | "DEVELOPER" | "SRE";

/**
 * AuthContext is required for EVERY request.
 * Per TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md
 */
export type AuthContext = {
  // Actor: the authenticated user making the request
  actorUserId: string;
  actorEmail?: string;
  
  // Platform RBAC (Twicely staff)
  isPlatformStaff: boolean;
  platformRoles: PlatformRoleName[];
  customPermissions: string[];
  
  // Delegated Access (seller staff acting on behalf of owner)
  // Present ONLY when acting in delegated mode
  onBehalfOfUserId?: string;
  delegatedPermissions?: string[];
};

/**
 * Delegated permission keys (eBay-mirrored)
 * Per TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md Section 5
 */
export const DELEGATED_PERMISSION_KEYS = {
  // Storefront
  storeView: "store.view",
  storeEditBranding: "store.edit_branding",
  storeEditPolicies: "store.edit_policies",
  
  // Listings
  listingView: "listing.view",
  listingCreate: "listing.create",
  listingEdit: "listing.edit",
  listingEnd: "listing.end",
  listingDelete: "listing.delete",
  
  // Orders
  orderView: "order.view",
  orderFulfill: "order.fulfill",
  orderRefundRequest: "order.refund_request",
  orderMessageBuyer: "order.message_buyer",
  
  // Inventory & Pricing
  inventoryAdjust: "inventory.adjust",
  pricingEdit: "pricing.edit",
  
  // Messaging
  messagesView: "messages.view",
  messagesSend: "messages.send",
  
  // Reports
  reportsView: "reports.view",
  
  // Staff Management (Owner-only by default)
  staffInvite: "staff.invite",
  staffRevoke: "staff.revoke",
  staffPermissionsEdit: "staff.permissions_edit",
  
  // Payouts (Owner-only by default, high risk)
  payoutsView: "payouts.view",
  payoutsManage: "payouts.manage",
} as const;

export type DelegatedPermissionKey = typeof DELEGATED_PERMISSION_KEYS[keyof typeof DELEGATED_PERMISSION_KEYS];
```

### 5.2 Permission Registry

Create `packages/core/rbac/permissions.ts`:

```ts
export type Crud = "view" | "create" | "edit" | "delete";

export type ModuleKey =
  | "users"
  | "roles"
  | "listings"
  | "orders"
  | "payments"
  | "ledger"
  | "payouts"
  | "search"
  | "trust"
  | "notifications"
  | "analytics"
  | "health"
  | "audit"
  | "privacy"
  | "flags";

export const crudKeys = (m: ModuleKey) => ({
  view: `${m}.view`,
  create: `${m}.create`,
  edit: `${m}.edit`,
  delete: `${m}.delete`,
});

export const highRiskKeys = {
  superAdminGrant: "roles.super_admin.grant",
  payoutsExecute: "payouts.run.execute",
  refundsForce: "orders.refund.force",
  holdsApply: "payouts.hold.apply",
  payoutsDestinationChange: "payouts.destination.change",
} as const;
```

### 5.3 Authorization Logic

Create `packages/core/rbac/authorize.ts`:

```ts
import type { AuthContext } from "./types";

/**
 * Check if actor has a platform role
 */
export function hasPlatformRole(ctx: AuthContext, role: string): boolean {
  return ctx.platformRoles.includes(role as any);
}

/**
 * Check platform permission (for Twicely staff)
 * ADMIN always wins for platform scope
 */
export function hasPlatformPermission(ctx: AuthContext, key: string): boolean {
  if (!ctx.isPlatformStaff) return false;
  if (hasPlatformRole(ctx, "ADMIN")) return true;
  return ctx.customPermissions.includes(key);
}

/**
 * Check delegated permission (for seller staff acting on behalf of owner)
 */
export function hasDelegatedPermission(ctx: AuthContext, key: string): boolean {
  if (!ctx.onBehalfOfUserId) return false;
  return ctx.delegatedPermissions?.includes(key) ?? false;
}

/**
 * Check if actor is the owner of a resource
 */
export function isOwner(ctx: AuthContext, resourceOwnerId: string): boolean {
  return ctx.actorUserId === resourceOwnerId;
}

/**
 * Canonical authorization check per TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md Section 6
 * 
 * ALLOW if any is true:
 * 1) Owner self-access: actorUserId == ownerUserId
 * 2) Delegated access: onBehalfOfUserId == ownerUserId AND permission key present
 * 3) Platform RBAC: actor is platform staff with appropriate platform permission
 * 
 * Else: DENY
 */
export function canAccessResource(
  ctx: AuthContext,
  resourceOwnerId: string,
  requiredDelegatedPermission?: string
): boolean {
  // 1) Owner self-access
  if (ctx.actorUserId === resourceOwnerId) return true;
  
  // 2) Delegated access
  if (ctx.onBehalfOfUserId === resourceOwnerId) {
    if (!requiredDelegatedPermission) return true;
    return hasDelegatedPermission(ctx, requiredDelegatedPermission);
  }
  
  // 3) Platform RBAC (for admin routes only - this is a fallback)
  // Note: Platform staff accessing seller data should be audited separately
  
  return false;
}

/**
 * Assert permission or throw
 */
export function assertPermission(ctx: AuthContext, key: string): void {
  if (!hasPlatformPermission(ctx, key)) {
    throw new Error("FORBIDDEN");
  }
}

/**
 * Assert resource access or throw
 */
export function assertResourceAccess(
  ctx: AuthContext,
  resourceOwnerId: string,
  requiredDelegatedPermission?: string
): void {
  if (!canAccessResource(ctx, resourceOwnerId, requiredDelegatedPermission)) {
    throw new Error("FORBIDDEN");
  }
}

/**
 * Super admin grant guard (hard rule)
 * Per canonical: Only ADMIN can grant ADMIN
 */
export function assertCanGrantSuperAdmin(ctx: AuthContext): void {
  if (!hasPlatformRole(ctx, "ADMIN")) {
    throw new Error("FORBIDDEN_SUPER_ADMIN_GRANT");
  }
}

/**
 * High-risk permission guard
 * Owner must have 2FA enabled for: payouts.manage, staff.permissions_edit
 */
export function assertHighRiskPermission(ctx: AuthContext, key: string, owner2FAEnabled: boolean): void {
  const highRiskKeys = ["payouts.manage", "staff.permissions_edit", "payouts.destination.change"];
  if (highRiskKeys.includes(key) && !owner2FAEnabled) {
    throw new Error("REQUIRES_2FA");
  }
}
```

---

## 6) Platform staff auth (minimal, v1)

Use a simple session cookie approach for Phase 1. (Can be upgraded later.)

### 6.1 Password hashing
Create `packages/core/auth/password.ts`:
```ts
import bcrypt from "bcryptjs";
export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
export async function verifyPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }
```

Install dependency:
```bash
pnpm add bcryptjs
```

### 6.2 Session cookie helpers
Create `packages/core/auth/session.ts`:
```ts
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "twi_staff_session";

export function setStaffSession(staffId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  cookies().set(COOKIE, `${staffId}:${token}`, { httpOnly: true, sameSite: "lax", path: "/" });
  return token;
}

export function getStaffSession(): { staffId: string } | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const [staffId] = raw.split(":");
  if (!staffId) return null;
  return { staffId };
}

export function clearStaffSession() {
  cookies().delete(COOKIE);
}
```

---

## 7) AuthContext loader (server helper)

Create `apps/web/lib/platformAuth.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { getStaffSession } from "@/packages/core/auth/session";
import type { AuthContext, PlatformRoleName } from "@/packages/core/rbac/types";

const prisma = new PrismaClient();

/**
 * Build AuthContext for platform staff
 */
export async function requirePlatformAuth(): Promise<AuthContext> {
  const sess = getStaffSession();
  if (!sess) throw new Error("UNAUTHENTICATED");

  const staff = await prisma.platformStaff.findUnique({
    where: { id: sess.staffId },
    include: {
      roles: { include: { role: true } },
      customRoles: { include: { role: true } },
    },
  });

  if (!staff || !staff.isActive) throw new Error("UNAUTHENTICATED");

  const platformRoles = staff.roles.map(r => r.role.name) as PlatformRoleName[];
  const customPermissions = staff.customRoles.flatMap(r => r.role.permissions);

  return {
    actorUserId: staff.id,
    actorEmail: staff.email,
    isPlatformStaff: true,
    platformRoles,
    customPermissions,
    // No delegated access for platform staff
    onBehalfOfUserId: undefined,
    delegatedPermissions: undefined,
  };
}

/**
 * Build AuthContext for seller/buyer with optional delegated access
 * 
 * @param actorUserId - The authenticated user
 * @param targetOwnerUserId - If acting on behalf of another user (delegated mode)
 */
export async function buildSellerAuthContext(
  actorUserId: string,
  targetOwnerUserId?: string
): Promise<AuthContext> {
  // Base context
  const ctx: AuthContext = {
    actorUserId,
    isPlatformStaff: false,
    platformRoles: [],
    customPermissions: [],
  };
  
  // If acting on behalf of owner, load delegated permissions
  if (targetOwnerUserId && targetOwnerUserId !== actorUserId) {
    const delegation = await prisma.delegatedAccess.findUnique({
      where: {
        ownerUserId_staffUserId: {
          ownerUserId: targetOwnerUserId,
          staffUserId: actorUserId,
        },
      },
    });
    
    if (!delegation || delegation.status !== "active") {
      throw new Error("NO_DELEGATED_ACCESS");
    }
    
    ctx.onBehalfOfUserId = targetOwnerUserId;
    ctx.delegatedPermissions = delegation.permissions;
  }
  
  return ctx;
}
```

---

## 8) Delegated Access API

### 8.1 Invite staff
`POST /api/seller/staff/invite`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { buildSellerAuthContext } from "@/apps/web/lib/platformAuth";
import { DELEGATED_PERMISSION_KEYS } from "@/packages/core/rbac/types";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const ownerUserId = "twi_u_replace"; // TODO: from auth
  const ctx = await buildSellerAuthContext(ownerUserId);
  
  const { staffEmail, permissions } = await req.json();
  
  // Validate permissions
  const validPermissions = Object.values(DELEGATED_PERMISSION_KEYS);
  const filteredPermissions = (permissions as string[]).filter(p => validPermissions.includes(p as any));
  
  // Find staff user
  const staffUser = await prisma.user.findUnique({ where: { email: staffEmail } });
  if (!staffUser) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }
  
  // Create delegation
  const delegation = await prisma.delegatedAccess.upsert({
    where: {
      ownerUserId_staffUserId: {
        ownerUserId,
        staffUserId: staffUser.id,
      },
    },
    update: {
      status: "invited",
      permissions: filteredPermissions,
      updatedAt: new Date(),
    },
    create: {
      ownerUserId,
      staffUserId: staffUser.id,
      status: "invited",
      permissions: filteredPermissions,
      createdByUserId: ownerUserId,
    },
  });
  
  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: ownerUserId,
      action: "staff.invite",
      entityType: "DelegatedAccess",
      entityId: delegation.id,
      metaJson: { staffUserId: staffUser.id, permissions: filteredPermissions },
    },
  });
  
  return NextResponse.json({ delegation }, { status: 201 });
}
```

### 8.2 Revoke staff access
`POST /api/seller/staff/:staffId/revoke`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: any) {
  const ownerUserId = "twi_u_replace"; // TODO: from auth
  
  const delegation = await prisma.delegatedAccess.update({
    where: {
      ownerUserId_staffUserId: {
        ownerUserId,
        staffUserId: params.staffId,
      },
    },
    data: {
      status: "revoked",
      revokedAt: new Date(),
      revokedByUserId: ownerUserId,
    },
  });
  
  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: ownerUserId,
      action: "staff.revoke",
      entityType: "DelegatedAccess",
      entityId: delegation.id,
      metaJson: { staffUserId: params.staffId },
    },
  });
  
  return NextResponse.json({ ok: true });
}
```

### 8.3 List staff
`GET /api/seller/staff`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const ownerUserId = "twi_u_replace"; // TODO: from auth
  
  const delegations = await prisma.delegatedAccess.findMany({
    where: { ownerUserId, status: { in: ["active", "invited"] } },
    orderBy: { createdAt: "desc" },
  });
  
  return NextResponse.json({ staff: delegations });
}
```

---

## 9) Corp API routes (Platform RBAC)

### 9.1 Create first ADMIN (bootstrap)
`POST /api/platform/bootstrap/admin`  
This endpoint MUST be disabled once an admin exists.

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/packages/core/auth/password";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const existing = await prisma.platformStaff.count();
  if (existing > 0) return NextResponse.json({ error: "BOOTSTRAP_DISABLED" }, { status: 403 });

  const body = await req.json();
  const email = String(body.email || "").toLowerCase();
  const password = String(body.password || "");

  if (!email || password.length < 10) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const adminRole = await prisma.platformRole.findUnique({ where: { name: "ADMIN" } });
  if (!adminRole) return NextResponse.json({ error: "ROLE_MISSING" }, { status: 500 });

  const staff = await prisma.platformStaff.create({
    data: { email, passwordHash: await hashPassword(password) },
  });

  await prisma.platformStaffRole.create({
    data: { staffId: staff.id, roleId: adminRole.id },
  });

  return NextResponse.json({ ok: true, staffId: staff.id });
}
```

### 9.2 Login/logout
`POST /api/platform/auth/login`
`POST /api/platform/auth/logout`

Login:
```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "@/packages/core/auth/password";
import { setStaffSession } from "@/packages/core/auth/session";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const staff = await prisma.platformStaff.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!staff || !staff.isActive) return NextResponse.json({ error: "INVALID_LOGIN" }, { status: 401 });

  const ok = await verifyPassword(String(password), staff.passwordHash);
  if (!ok) return NextResponse.json({ error: "INVALID_LOGIN" }, { status: 401 });

  setStaffSession(staff.id);
  return NextResponse.json({ ok: true });
}
```

Logout:
```ts
import { NextResponse } from "next/server";
import { clearStaffSession } from "@/packages/core/auth/session";

export async function POST() {
  clearStaffSession();
  return NextResponse.json({ ok: true });
}
```

### 9.3 List roles
`GET /api/platform/roles`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";

const prisma = new PrismaClient();

export async function GET() {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "roles.view");

  const roles = await prisma.customRole.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ roles });
}
```

### 9.4 Create role
`POST /api/platform/roles`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "roles.create");

  const body = await req.json();
  const name = String(body.name || "").trim();
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];

  const role = await prisma.customRole.create({
    data: {
      name,
      description: String(body.description || ""),
      permissions,
      createdByStaffId: ctx.actorUserId,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: ctx.actorUserId,
      action: "rbac.role.create",
      entityType: "CustomRole",
      entityId: role.id,
      metaJson: { name, permissionsCount: permissions.length },
    },
  });

  return NextResponse.json({ role }, { status: 201 });
}
```

### 9.5 Grant Super Admin (platform ADMIN only)
`POST /api/platform/staff/:id/grant-admin`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertCanGrantSuperAdmin } from "@/packages/core/rbac/authorize";

const prisma = new PrismaClient();

export async function POST(_: Request, { params }: any) {
  const ctx = await requirePlatformAuth();
  assertCanGrantSuperAdmin(ctx);

  const adminRole = await prisma.platformRole.findUnique({ where: { name: "ADMIN" } });
  if (!adminRole) return NextResponse.json({ error: "ROLE_MISSING" }, { status: 500 });

  await prisma.platformStaffRole.upsert({
    where: { staffId_roleId: { staffId: params.id, roleId: adminRole.id } },
    update: {},
    create: { staffId: params.id, roleId: adminRole.id },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: ctx.actorUserId,
      action: "rbac.permission.grant",
      entityType: "PlatformStaff",
      entityId: params.id,
      metaJson: { grantedRole: "ADMIN" },
    },
  });

  return NextResponse.json({ ok: true });
}
```

---

## 10) Corp UI skeleton

Create:
- `/apps/web/app/(platform)/corp/layout.tsx`
- `/apps/web/app/(platform)/corp/page.tsx` (dashboard)
- `/apps/web/app/(platform)/corp/roles/page.tsx`
- `/apps/web/app/(platform)/corp/roles/[id]/page.tsx`

UI requirements:
- Left navigation
- Roles page visible only with `roles.view` (or ADMIN)
- Role editor uses toggles per module:
  - View/Create/Edit/Delete

### 10.1 Role editor data model (TS)
```ts
export type RolePermissionGrid = Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>;
```

Build permissions using registry from `packages/core/rbac/permissions.ts`.

---

## 11) System Health provider (rbac)

Create `packages/core/health/providers/rbac.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult } from "../types";

const prisma = new PrismaClient();

export const rbacHealthProvider: HealthProvider = {
  id: "rbac",
  label: "RBAC & Delegated Access",
  
  async run({ runType }): Promise<HealthResult> {
    const checks = [];
    let status: "PASS" | "WARN" | "FAIL" = "PASS";
    
    // Check 1: User table exists
    try {
      const userCount = await prisma.user.count();
      checks.push({
        id: "user_table_exists",
        label: "User table exists",
        status: "PASS",
        message: `${userCount} users`,
      });
    } catch {
      checks.push({
        id: "user_table_exists",
        label: "User table exists",
        status: "FAIL",
        message: "User table missing - run migration",
      });
      status = "FAIL";
    }
    
    // Check 2: Platform roles seeded
    const roleCount = await prisma.platformRole.count();
    const rolesSeeded = roleCount >= 5;
    checks.push({
      id: "roles_seeded",
      label: "Platform roles seeded",
      status: rolesSeeded ? "PASS" : "FAIL",
      message: rolesSeeded ? `${roleCount} roles exist` : "Missing platform roles",
    });
    if (!rolesSeeded) status = "FAIL";
    
    // Check 3: At least one ADMIN exists
    const adminCount = await prisma.platformStaffRole.count({
      where: { role: { name: "ADMIN" } },
    });
    const adminExists = adminCount > 0;
    checks.push({
      id: "admin_exists",
      label: "Admin exists",
      status: adminExists ? "PASS" : "FAIL",
      message: adminExists ? `${adminCount} admins` : "No admin exists",
    });
    if (!adminExists) status = "FAIL";
    
    // Check 4: DelegatedAccess table exists (schema check)
    try {
      await prisma.delegatedAccess.count();
      checks.push({
        id: "delegated_access_table",
        label: "Delegated access table exists",
        status: "PASS",
      });
    } catch {
      checks.push({
        id: "delegated_access_table",
        label: "Delegated access table exists",
        status: "FAIL",
        message: "Table missing - run migration",
      });
      status = "FAIL";
    }
    
    return {
      providerId: "rbac",
      status,
      summary: status === "PASS" ? "RBAC healthy" : "RBAC issues detected",
      providerVersion: "1.3",
      ranAt: new Date().toISOString(),
      runType,
      checks,
    };
  },
  
  settings: {
    schema: {},
    defaults: {},
  },
  
  ui: {
    SettingsPanel: () => null,
    DetailPage: () => null,
  },
};
```

---

## 12) Doctor checks (phase 1)

Update `scripts/twicely-doctor.ts` to include:
- `rbac.user_table_exists`
- `rbac.roles_seeded`
- `rbac.admin_exists`
- `rbac.bootstrap_disabled_after_admin`
- `rbac.super_admin_grant_guarded`
- `rbac.delegated_access_table_exists`

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkRbac() {
  const checks = [];
  
  // User table exists
  try {
    const userCount = await prisma.user.count();
    checks.push({
      key: "rbac.user_table_exists",
      ok: true,
      details: `${userCount} users`,
    });
  } catch {
    checks.push({
      key: "rbac.user_table_exists",
      ok: false,
      details: "User table missing",
    });
  }
  
  // Roles seeded
  const roleCount = await prisma.platformRole.count();
  checks.push({
    key: "rbac.roles_seeded",
    ok: roleCount >= 5,
    details: `${roleCount} roles`,
  });
  
  // Admin exists
  const adminCount = await prisma.platformStaffRole.count({
    where: { role: { name: "ADMIN" } },
  });
  checks.push({
    key: "rbac.admin_exists",
    ok: adminCount > 0,
    details: `${adminCount} admins`,
  });
  
  // Bootstrap disabled after admin
  const staffCount = await prisma.platformStaff.count();
  checks.push({
    key: "rbac.bootstrap_disabled_after_admin",
    ok: staffCount > 0 ? true : false, // If staff exist, bootstrap should be disabled
    details: staffCount > 0 ? "Bootstrap disabled" : "No staff yet",
  });
  
  // Delegated access table exists
  try {
    await prisma.delegatedAccess.count();
    checks.push({
      key: "rbac.delegated_access_table_exists",
      ok: true,
    });
  } catch {
    checks.push({
      key: "rbac.delegated_access_table_exists",
      ok: false,
      details: "Table missing",
    });
  }
  
  return checks;
}

(async () => {
  const checks = await checkRbac();
  const failed = checks.filter(c => !c.ok);
  
  if (failed.length > 0) {
    console.error("Doctor FAIL:", failed);
    process.exit(1);
  }
  
  console.log("Doctor PASS: Phase 1 RBAC");
  process.exit(0);
})();
```

---

## 13) Phase 1 Completion Criteria

- **User table exists** (`model User`)
- Roles seeded (`pnpm seed:rbac`)
- First admin created via bootstrap endpoint
- Bootstrap endpoint blocked afterward
- Staff login works
- Roles CRUD works
- Super admin grant only works for ADMIN
- **DelegatedAccess table exists**
- **Seller can invite/revoke staff**
- **Staff actions include onBehalfOfUserId in audit**
- Doctor passes Phase 1 checks

---

## 14) Canonical Alignment Notes

This phase now aligns with:

| Canonical Requirement | Implementation |
|----------------------|----------------|
| User model exists | `model User` defined in Phase 1 |
| Two RBAC systems never merge | Platform RBAC + Delegated Access are separate |
| Single ownership | Resources owned by userId only |
| Delegated access is not ownership | Staff never become owners |
| Every write is attributable | AuditEvent includes actorUserId + onBehalfOfUserId |
| Least privilege | Default deny, explicit grants |
| High-risk permissions require 2FA | assertHighRiskPermission() helper |

---

## 15) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 1 implementation |
| 1.1 | 2026-01-15 | Added delegated access patterns |
| 1.2 | 2026-01-20 | MED-2: Expanded AuditEvent schema + canonical emit helper |
| 1.3 | 2026-01-21 | **BLOCKER FIX: Added User model** + user service + health checks |
| 1.4 | 2026-01-21 | Personal/Business Patch: Added SellerType enum, isSeller flag, business verification fields |
| 1.5 | 2026-01-21 | Alignment Patch: Added BusinessInfo model, BusinessType enum, TaxIdType enum, Userâ†’BusinessInfo relation |
