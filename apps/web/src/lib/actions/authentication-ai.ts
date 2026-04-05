'use server';

import { z } from 'zod';
import { eq, and, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { authenticationRequest, listing } from '@twicely/db/schema';
import { authorize, sub } from '@twicely/casl';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { generateCertNumber } from '@/lib/authentication/cert-number';
import { getAiAuthProvider } from '@/lib/authentication/ai-provider-factory';
import { AUTH_SETTINGS_KEYS } from '@/lib/authentication/constants';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';

interface ActionResult {
  success: boolean;
  error?: string;
  requestId?: string;
  certificateNumber?: string;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const requestAiAuthSchema = z.object({
  listingId: z.string().cuid2(),
  orderId: z.string().cuid2().optional(),
  photoUrls: z.array(z.string().url()).min(3).max(20),
}).strict();

const retryAiAuthSchema = z.object({
  requestId: z.string().cuid2(),
  photoUrls: z.array(z.string().url()).min(3).max(20),
}).strict();

// ─── Action 1: requestAiAuthentication ───────────────────────────────────────

export async function requestAiAuthentication(
  rawData: unknown
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'You must be logged in' };

  // SEC-028: Rate limit AI auth request creation (3 per hour per user)
  try {
    const valkey = getValkeyClient();
    const rlKey = `auth-req-rate:${session.userId}`;
    const attempts = await valkey.incr(rlKey);
    if (attempts === 1) await valkey.expire(rlKey, 3600);
    if (attempts > 3) {
      return { success: false, error: 'Too many authentication requests. Please try again later.' };
    }
  } catch (err) {
    logger.warn('[authentication-ai] Rate limit check failed', { error: String(err) });
  }

  const aiEnabled = await getPlatformSetting<boolean>(
    AUTH_SETTINGS_KEYS.AI_ENABLED,
    false
  );
  if (!aiEnabled) {
    return { success: false, error: 'AI authentication is not currently available' };
  }

  const parsed = requestAiAuthSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  if (session.delegationId !== null) {
    return { success: false, error: 'Delegated staff cannot create authentication requests' };
  }

  const { listingId, orderId, photoUrls } = parsed.data;

  const [listingRow] = await db
    .select({
      id: listing.id,
      ownerUserId: listing.ownerUserId,
      status: listing.status,
      slug: listing.slug,
      title: listing.title,
      priceCents: listing.priceCents,
      categoryId: listing.categoryId,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) return { success: false, error: 'Listing not found' };

  const isSeller = session.userId === listingRow.ownerUserId;
  const isBuyer = !!orderId && !isSeller;
  const initiator = isSeller ? 'SELLER' : 'BUYER';

  if (isSeller && !ability.can('create', sub('AuthenticationRequest', { sellerId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  if (isBuyer && !ability.can('create', sub('AuthenticationRequest', { buyerId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  if (!isSeller && !isBuyer) {
    return { success: false, error: 'Forbidden' };
  }

  const totalFeeCents = await getPlatformSetting<number>(
    AUTH_SETTINGS_KEYS.AI_FEE_CENTS,
    1999
  );

  const certNumber = await generateCertNumber();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';
  const verifyUrl = `${baseUrl}/verify/${certNumber}`;

  const [newRequest] = await db
    .insert(authenticationRequest)
    .values({
      listingId,
      orderId: orderId ?? null,
      sellerId: listingRow.ownerUserId,
      buyerId: isBuyer ? session.userId : null,
      initiator,
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents,
      buyerFeeCents: null,
      sellerFeeCents: null,
      certificateNumber: certNumber,
      verifyUrl,
      photoUrls,
    })
    .returning({ id: authenticationRequest.id });

  if (!newRequest) return { success: false, error: 'Failed to create authentication request' };

  const aiProvider = await getAiAuthProvider();
  const { providerRef, submittedAt } = await aiProvider.submitForAuthentication({
    requestId: newRequest.id,
    photoUrls,
    category: listingRow.categoryId ?? '',
    itemTitle: listingRow.title ?? '',
    itemPriceCents: listingRow.priceCents ?? 0,
  });

  await db
    .update(authenticationRequest)
    .set({ providerRef, submittedAt, updatedAt: new Date() })
    .where(eq(authenticationRequest.id, newRequest.id));

  await db
    .update(listing)
    .set({
      authenticationStatus: 'AI_PENDING',
      authenticationRequestId: newRequest.id,
      updatedAt: new Date(),
    })
    .where(eq(listing.id, listingId));

  revalidatePath(`/i/${listingRow.slug ?? listingId}`);
  return { success: true, requestId: newRequest.id, certificateNumber: certNumber };
}

// ─── Action 2: retryAiAuthentication ─────────────────────────────────────────

export async function retryAiAuthentication(
  rawData: unknown
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'You must be logged in' };

  const aiEnabled = await getPlatformSetting<boolean>(
    AUTH_SETTINGS_KEYS.AI_ENABLED,
    false
  );
  if (!aiEnabled) {
    return { success: false, error: 'AI authentication is not currently available' };
  }

  const parsed = retryAiAuthSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { requestId, photoUrls } = parsed.data;

  const [originalReq] = await db
    .select({
      id: authenticationRequest.id,
      listingId: authenticationRequest.listingId,
      sellerId: authenticationRequest.sellerId,
      status: authenticationRequest.status,
      tier: authenticationRequest.tier,
    })
    .from(authenticationRequest)
    .where(eq(authenticationRequest.id, requestId))
    .limit(1);

  if (!originalReq) return { success: false, error: 'Authentication request not found' };

  if (originalReq.status !== 'AI_INCONCLUSIVE') {
    return { success: false, error: 'Only AI_INCONCLUSIVE requests can be retried' };
  }

  // Only seller can retry
  if (session.userId !== originalReq.sellerId) {
    return { success: false, error: 'Only the seller can retry authentication' };
  }

  if (!ability.can('create', sub('AuthenticationRequest', { sellerId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // Max one retry: check if there is already a retry request for this listing
  // (another AI_PENDING or completed AI request beyond the original INCONCLUSIVE)
  const [retryCount] = await db
    .select({ total: count() })
    .from(authenticationRequest)
    .where(
      and(
        eq(authenticationRequest.listingId, originalReq.listingId),
        eq(authenticationRequest.tier, 'AI')
      )
    );

  // If count > 1, a retry already exists (original inconclusive + at least one retry)
  if ((retryCount?.total ?? 0) > 1) {
    return { success: false, error: 'Only one retry is permitted per authentication request' };
  }

  const [listingRow] = await db
    .select({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      priceCents: listing.priceCents,
      categoryId: listing.categoryId,
    })
    .from(listing)
    .where(eq(listing.id, originalReq.listingId))
    .limit(1);

  if (!listingRow) return { success: false, error: 'Listing not found' };

  const certNumber = await generateCertNumber();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';
  const verifyUrl = `${baseUrl}/verify/${certNumber}`;

  const [newRequest] = await db
    .insert(authenticationRequest)
    .values({
      listingId: originalReq.listingId,
      orderId: null,
      sellerId: originalReq.sellerId,
      buyerId: null,
      initiator: 'SELLER',
      tier: 'AI',
      status: 'AI_PENDING',
      totalFeeCents: 0,
      buyerFeeCents: 0,
      sellerFeeCents: 0,
      certificateNumber: certNumber,
      verifyUrl,
      photoUrls,
    })
    .returning({ id: authenticationRequest.id });

  if (!newRequest) return { success: false, error: 'Failed to create retry request' };

  const aiProvider = await getAiAuthProvider();
  const { providerRef, submittedAt } = await aiProvider.submitForAuthentication({
    requestId: newRequest.id,
    photoUrls,
    category: listingRow.categoryId ?? '',
    itemTitle: listingRow.title ?? '',
    itemPriceCents: listingRow.priceCents ?? 0,
  });

  await db
    .update(authenticationRequest)
    .set({ providerRef, submittedAt, updatedAt: new Date() })
    .where(eq(authenticationRequest.id, newRequest.id));

  await db
    .update(listing)
    .set({
      authenticationStatus: 'AI_PENDING',
      authenticationRequestId: newRequest.id,
      updatedAt: new Date(),
    })
    .where(eq(listing.id, originalReq.listingId));

  revalidatePath(`/i/${listingRow.slug ?? originalReq.listingId}`);
  return { success: true, requestId: newRequest.id, certificateNumber: certNumber };
}
