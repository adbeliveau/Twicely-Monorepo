'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { authenticationRequest, listing, sellerProfile, auditEvent } from '@twicely/db/schema';
import { authorize, sub } from '@twicely/casl';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { computeCompositeHash } from '@/lib/authentication/phash';
import { CERTIFICATE_PREFIX, AUTH_SETTINGS_KEYS } from '@/lib/authentication/constants';

interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const approveVerifiedSellerSchema = z.object({
  sellerId: z.string().cuid2(),
  approved: z.boolean(),
  notes: z.string().max(2000).optional(),
}).strict();

const requestItemAuthSchema = z.object({
  listingId: z.string().cuid2(),
  orderId: z.string().cuid2().optional(),
  tier: z.literal('EXPERT'),
  photoUrls: z.array(z.string().url()).min(3).max(20),
}).strict();

const submitPhotosSchema = z.object({
  requestId: z.string().cuid2(),
  photoUrls: z.array(z.string().url()).min(3).max(20),
}).strict();

// ─── Certificate number generation ─────────────────────────────────────────

const CERT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export async function generateUniqueCertNumber(): Promise<string> {
  const { session, ability } = await authorize();
  if (!session) throw new Error('Authentication required');
  if (!ability.can('create', 'AuthenticationRequest')) {
    throw new Error('Not authorized to generate certificate numbers');
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += CERT_CHARS[Math.floor(Math.random() * CERT_CHARS.length)];
    }
    const certNumber = `${CERTIFICATE_PREFIX}${suffix}`;
    const [existing] = await db
      .select({ id: authenticationRequest.id })
      .from(authenticationRequest)
      .where(eq(authenticationRequest.certificateNumber, certNumber))
      .limit(1);
    if (!existing) return certNumber;
  }
  throw new Error('Failed to generate unique certificate number after 10 attempts');
}

// ─── Action 1: approveVerifiedSeller (D6.1) ─────────────────────────────────

export async function approveVerifiedSeller(rawData: unknown): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!session) return { success: false, error: 'Staff access required' };

  const parsed = approveVerifiedSellerSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { sellerId, approved, notes } = parsed.data;

  const [profile] = await db
    .select({ id: sellerProfile.id, userId: sellerProfile.userId })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerId))
    .limit(1);

  if (!profile) return { success: false, error: 'Seller not found' };

  if (!ability.can('manage', sub('SellerProfile', { userId: profile.userId }))) {
    return { success: false, error: 'Admin access required' };
  }

  if (approved) {
    await db
      .update(sellerProfile)
      .set({ isAuthenticatedSeller: true, updatedAt: new Date() })
      .where(eq(sellerProfile.id, sellerId));
  }

  await db.insert(auditEvent).values({
    actorType: 'PLATFORM_STAFF',
    actorId: session.staffUserId,
    action: approved ? 'SELLER_VERIFIED_APPROVED' : 'SELLER_VERIFIED_DENIED',
    subject: 'SellerProfile',
    subjectId: sellerId,
    severity: 'MEDIUM',
    detailsJson: { notes: notes ?? null },
  });

  revalidatePath('/my/selling/store');
  return { success: true };
}

// ─── Action 2: requestItemAuthentication (D6.2) ─────────────────────────────

export async function requestItemAuthentication(
  rawData: unknown
): Promise<ActionResult & { requestId?: string; certificateNumber?: string }> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'You must be logged in' };

  const parsed = requestItemAuthSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: 'Invalid input' };
  if (session.delegationId !== null) {
    return { success: false, error: 'Delegated staff cannot create authentication requests' };
  }

  const { listingId, orderId, photoUrls } = parsed.data;

  const [listingRow] = await db
    .select({ id: listing.id, ownerUserId: listing.ownerUserId, status: listing.status, slug: listing.slug })
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

  const totalFeeCents = await getPlatformSetting<number>(AUTH_SETTINGS_KEYS.EXPERT_FEE_CENTS, 3999);
  const certNumber = await generateUniqueCertNumber();
  const verifyUrl = `https://twicely.co/verify/${certNumber}`;

  const [newRequest] = await db
    .insert(authenticationRequest)
    .values({
      listingId,
      orderId: orderId ?? null,
      sellerId: listingRow.ownerUserId,
      buyerId: isBuyer ? session.userId : null,
      initiator,
      tier: 'EXPERT',
      status: 'EXPERT_PENDING',
      totalFeeCents,
      buyerFeeCents: null,
      sellerFeeCents: null,
      certificateNumber: certNumber,
      verifyUrl,
      photoUrls,
    })
    .returning({ id: authenticationRequest.id });

  if (!newRequest) return { success: false, error: 'Failed to create authentication request' };

  await db
    .update(listing)
    .set({ authenticationStatus: 'EXPERT_PENDING', authenticationRequestId: newRequest.id, updatedAt: new Date() })
    .where(eq(listing.id, listingId));

  revalidatePath(`/i/${listingRow.slug ?? listingId}`);
  return { success: true, requestId: newRequest.id, certificateNumber: certNumber };
}

// ─── Action 3: submitAuthenticationPhotos (D6.4) ────────────────────────────

export async function submitAuthenticationPhotos(rawData: unknown): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'You must be logged in' };

  const parsed = submitPhotosSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { requestId, photoUrls } = parsed.data;

  const [req] = await db
    .select({ id: authenticationRequest.id, status: authenticationRequest.status, sellerId: authenticationRequest.sellerId })
    .from(authenticationRequest)
    .where(eq(authenticationRequest.id, requestId))
    .limit(1);

  if (!req) return { success: false, error: 'Authentication request not found' };

  if (!ability.can('update', sub('AuthenticationRequest', { sellerId: req.sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const pendingStatuses = ['AI_PENDING', 'EXPERT_PENDING'];
  if (!pendingStatuses.includes(req.status)) {
    return { success: false, error: 'Request is not in a pending status' };
  }

  const photosHash = await computeCompositeHash(photoUrls);

  await db
    .update(authenticationRequest)
    .set({ photoUrls, photosHash, updatedAt: new Date() })
    .where(eq(authenticationRequest.id, requestId));

  return { success: true };
}
