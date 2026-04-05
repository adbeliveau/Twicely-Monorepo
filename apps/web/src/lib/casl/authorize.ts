import { headers } from 'next/headers';
import { eq, and, or, isNull, gt } from 'drizzle-orm';
import { auth } from '@twicely/auth/server';
import { db } from '@twicely/db';
import { user as userTable } from '@twicely/db/schema';
import { delegatedAccess } from '@/lib/db/schema/subscriptions';
import { sellerProfile } from '@/lib/db/schema/identity';
import { defineAbilitiesFor } from '@twicely/casl/ability';
import type { AppAbility, CaslSession } from '@twicely/casl/types';
import { getImpersonationSession } from '@/lib/auth/impersonation';
import { logger } from '@twicely/logger';

/**
 * Custom error for authorization failures
 */
export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Server-side authorization helper
 * Returns the CASL ability and session for the current request
 */
export async function authorize(): Promise<{
  ability: AppAbility;
  session: CaslSession | null;
}> {
  const betterAuthSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!betterAuthSession) {
    // Guest - return guest abilities
    const ability = defineAbilitiesFor(null);
    return { ability, session: null };
  }

  const { user } = betterAuthSession;

  // H1 Security: Block banned users immediately — treat as unauthenticated
  if ((user as { isBanned?: boolean }).isBanned) {
    const ability = defineAbilitiesFor(null);
    return { ability, session: null };
  }

  // ── G10.8 Staff impersonation: override effective user context ──────
  // If a valid impersonation cookie is present, the staff user (authenticated
  // via Better Auth) views the target user's context. The impersonation token
  // is already HMAC-signed and time-limited (15 min) by the start route.
  let impersonation: { targetUserId: string; staffUserId: string } | null = null;
  try {
    const impersonationSession = await getImpersonationSession();
    if (impersonationSession) {
      // Security: only honor impersonation if the authenticated user matches the staff user
      if (impersonationSession.staffUserId === user.id) {
        impersonation = {
          targetUserId: impersonationSession.targetUserId,
          staffUserId: impersonationSession.staffUserId,
        };
      } else {
        logger.warn('[authorize] Impersonation token staffUserId mismatch', {
          tokenStaffUser: impersonationSession.staffUserId,
          authenticatedUser: user.id,
        });
      }
    }
  } catch {
    // Impersonation cookie absent or IMPERSONATION_SECRET not set — proceed normally
  }

  // Determine the effective user for this request
  let effectiveUserId: string;
  let effectiveEmail: string;
  let effectiveIsSeller: boolean;

  if (impersonation) {
    // Load the target user's identity from DB
    const [targetUser] = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        isSeller: userTable.isSeller,
      })
      .from(userTable)
      .where(eq(userTable.id, impersonation.targetUserId))
      .limit(1);

    if (!targetUser) {
      logger.warn('[authorize] Impersonation target user not found', { targetUserId: impersonation.targetUserId });
      // Fall back to the staff's own identity
      effectiveUserId = user.id;
      effectiveEmail = user.email;
      effectiveIsSeller = user.isSeller ?? false;
      impersonation = null;
    } else {
      effectiveUserId = targetUser.id;
      effectiveEmail = targetUser.email;
      effectiveIsSeller = targetUser.isSeller;
    }
  } else {
    effectiveUserId = user.id;
    effectiveEmail = user.email;
    effectiveIsSeller = user.isSeller ?? false;
  }

  // sellerId is the effective user's own id — all ownership columns in DB use user.id
  const sellerId: string | null = effectiveIsSeller ? effectiveUserId : null;

  // SEC-034: Load seller status from DB so CASL rules that gate on sellerStatus work
  let sellerStatus: string | null = null;
  if (sellerId) {
    const [sp] = await db
      .select({ status: sellerProfile.status })
      .from(sellerProfile)
      .where(eq(sellerProfile.userId, sellerId))
      .limit(1);
    sellerStatus = sp?.status ?? null;
  }

  // Lookup active delegation for the effective user (D5 staff context)
  let delegationId: string | null = null;
  let onBehalfOfSellerId: string | null = null;
  let onBehalfOfSellerProfileId: string | null = null;
  let delegatedScopes: string[] = [];

  const now = new Date();
  const [activeDelegation] = await db
    .select({
      id: delegatedAccess.id,
      sellerProfileId: delegatedAccess.sellerId,
      sellerUserId: sellerProfile.userId,
      scopes: delegatedAccess.scopes,
    })
    .from(delegatedAccess)
    .innerJoin(sellerProfile, eq(sellerProfile.id, delegatedAccess.sellerId))
    .where(
      and(
        eq(delegatedAccess.userId, effectiveUserId),
        eq(delegatedAccess.status, 'ACTIVE'),
        or(isNull(delegatedAccess.expiresAt), gt(delegatedAccess.expiresAt, now))
      )
    )
    .limit(1);

  if (activeDelegation) {
    delegationId = activeDelegation.id;
    // Resolve to the seller's user.id — all business tables use user.id, not sellerProfile.id
    onBehalfOfSellerId = activeDelegation.sellerUserId;
    // Keep the sellerProfile.id for subscription/delegation tables that FK to sellerProfile
    onBehalfOfSellerProfileId = activeDelegation.sellerProfileId;
    delegatedScopes = activeDelegation.scopes;
  }

  const caslSession: CaslSession = {
    userId: effectiveUserId,
    email: effectiveEmail,
    isSeller: effectiveIsSeller,
    sellerId,
    sellerStatus,
    delegationId,
    onBehalfOfSellerId,
    onBehalfOfSellerProfileId,
    delegatedScopes,
    isPlatformStaff: false,
    platformRoles: [],
  };

  const ability = defineAbilitiesFor(caslSession);
  return { ability, session: caslSession };
}

/**
 * Variant of authorize() that throws ForbiddenError if no authenticated session.
 * Use this in any action/route that requires authentication (most mutations).
 * Guest-compatible routes (cart, listing detail) should keep using authorize().
 */
export async function requireAuth(): Promise<{
  ability: AppAbility;
  session: CaslSession;
}> {
  const result = await authorize();
  if (!result.session) {
    throw new ForbiddenError('Authentication required');
  }
  return { ability: result.ability, session: result.session };
}
