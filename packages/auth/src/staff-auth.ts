import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { compare } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from '@twicely/db';
import { staffUser, staffUserRole, staffSession } from '@twicely/db/schema';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';

// Platform staff roles - mirrors platformRoleEnum in @twicely/db/schema/enums
type PlatformRole =
  | 'HELPDESK_AGENT'
  | 'HELPDESK_LEAD'
  | 'HELPDESK_MANAGER'
  | 'SUPPORT'
  | 'MODERATION'
  | 'FINANCE'
  | 'DEVELOPER'
  | 'SRE'
  | 'ADMIN'
  | 'SUPER_ADMIN';

// Fallback defaults (only used if platform_settings DB is unreachable)
const DEFAULT_SESSION_ABSOLUTE_HOURS = 8;
const DEFAULT_SESSION_INACTIVITY_MINUTES = 5;

export interface StaffSessionResult {
  token: string;
  staffUserId: string;
  email: string;
  displayName: string;
  roles: PlatformRole[];
  expiresAt: Date;
}

/**
 * Authenticate a staff user with email + password.
 * Creates a staffSession row on success.
 * Rate limiting is handled by the server action caller (staff-login.ts).
 */
export async function loginStaff(
  email: string,
  password: string
): Promise<StaffSessionResult> {
  const [user] = await db
    .select()
    .from(staffUser)
    .where(eq(staffUser.email, email))
    .limit(1);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    throw new Error('Invalid email or password');
  }

  const passwordValid = await compare(password, user.passwordHash);
  if (!passwordValid) {
    logger.info('[staff-auth] Failed login attempt', { email });
    throw new Error('Invalid email or password');
  }

  // Load all roles for this staff user (filter revoked in application layer)
  const allRoleRows = await db
    .select({ role: staffUserRole.role, revokedAt: staffUserRole.revokedAt })
    .from(staffUserRole)
    .where(eq(staffUserRole.staffUserId, user.id));

  const activeRoles = allRoleRows
    .filter((r) => r.revokedAt === null)
    .map((r) => r.role as PlatformRole);

  // Deduplicate
  const roles = [...new Set(activeRoles)];

  const token = randomBytes(32).toString('hex');
  const now = new Date();
  const absoluteHours = await getPlatformSetting<number>(
    'general.staffSessionAbsoluteHours',
    DEFAULT_SESSION_ABSOLUTE_HOURS,
  );
  const expiresAt = new Date(
    now.getTime() + absoluteHours * 60 * 60 * 1000
  );

  await db.insert(staffSession).values({
    staffUserId: user.id,
    token,
    expiresAt,
    lastActivityAt: now,
  });

  // Update lastLoginAt
  await db
    .update(staffUser)
    .set({ lastLoginAt: now })
    .where(eq(staffUser.id, user.id));

  return {
    token,
    staffUserId: user.id,
    email: user.email,
    displayName: user.displayName,
    roles,
    expiresAt,
  };
}

/**
 * Resolve a staff session by token.
 * Verifies absolute expiry and 30-minute inactivity timeout.
 * Updates lastActivityAt on valid sessions.
 * Wrapped with React cache() to deduplicate within the same request
 * (hub layout + page both call this with the same token).
 */
export const getStaffSession = cache(async function getStaffSession(
  token: string
): Promise<StaffSessionResult | null> {
  const now = new Date();

  const [session] = await db
    .select()
    .from(staffSession)
    .where(eq(staffSession.token, token))
    .limit(1);

  if (!session) {
    return null;
  }

  // Check absolute expiry
  if (session.expiresAt < now) {
    await db
      .delete(staffSession)
      .where(eq(staffSession.token, token));
    return null;
  }

  // Check inactivity timeout (configurable via platform_settings)
  const inactivityMinutes = await getPlatformSetting<number>(
    'general.staffInactivityTimeoutMinutes',
    DEFAULT_SESSION_INACTIVITY_MINUTES,
  );
  const inactivityCutoff = new Date(
    now.getTime() - inactivityMinutes * 60 * 1000
  );
  if (session.lastActivityAt < inactivityCutoff) {
    await db
      .delete(staffSession)
      .where(eq(staffSession.token, token));
    return null;
  }

  // Load staff user and roles in parallel (independent queries)
  const [userResult, allRoleRows] = await Promise.all([
    db
      .select()
      .from(staffUser)
      .where(eq(staffUser.id, session.staffUserId))
      .limit(1),
    db
      .select({ role: staffUserRole.role, revokedAt: staffUserRole.revokedAt })
      .from(staffUserRole)
      .where(eq(staffUserRole.staffUserId, session.staffUserId)),
  ]);

  const user = userResult[0];
  if (!user || !user.isActive) {
    return null;
  }

  const activeRoles = allRoleRows
    .filter((r) => r.revokedAt === null)
    .map((r) => r.role as PlatformRole);

  const roles = [...new Set(activeRoles)];

  // Update lastActivityAt non-blocking (fire-and-forget)
  db.update(staffSession)
    .set({ lastActivityAt: now })
    .where(eq(staffSession.token, token))
    .then(() => {}, () => {});

  return {
    token,
    staffUserId: user.id,
    email: user.email,
    displayName: user.displayName,
    roles,
    expiresAt: session.expiresAt,
  };
});

/**
 * Delete a staff session (logout).
 */
export async function logoutStaff(token: string): Promise<void> {
  await db
    .delete(staffSession)
    .where(eq(staffSession.token, token));
}
