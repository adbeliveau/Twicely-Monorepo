import { headers } from 'next/headers';
import { eq, and, or, isNull, gt } from 'drizzle-orm';
import { auth } from '@twicely/auth/server';
import { db } from '@twicely/db';
import { delegatedAccess } from '@/lib/db/schema/subscriptions';
import { sellerProfile } from '@/lib/db/schema/identity';
import { defineAbilitiesFor } from '@twicely/casl/ability';
import type { AppAbility, CaslSession } from '@twicely/casl/types';

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

  // sellerId is the user's own id — all ownership columns in DB use user.id
  const sellerId: string | null = user.isSeller ? user.id : null;

  // Lookup active delegation for this user (D5 staff context)
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
        eq(delegatedAccess.userId, user.id),
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
    userId: user.id,
    email: user.email,
    isSeller: user.isSeller ?? false,
    sellerId,
    sellerStatus: null,
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
