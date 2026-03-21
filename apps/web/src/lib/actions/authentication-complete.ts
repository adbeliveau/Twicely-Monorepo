'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@twicely/db';
import { authenticationRequest, listing, auditEvent } from '@twicely/db/schema';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { calculateAuthCostSplit } from '@/lib/authentication/cost-split';
import { AUTH_STATUS_AUTHENTICATED } from '@/lib/authentication/constants';

interface ActionResult {
  success: boolean;
  error?: string;
}

const completeAuthSchema = z.object({
  requestId: z.string().cuid2(),
  result: z.enum(['AUTHENTICATED', 'COUNTERFEIT']),
  resultNotes: z.string().max(5000).optional(),
  authenticatorId: z.string().cuid2().optional(),
}).strict();

const invalidateCertSchema = z.object({
  listingId: z.string().cuid2(),
  reason: z.enum(['RELISTED', 'LISTING_ENDED', 'ADMIN_REVOKED', 'FRAUD_DETECTED']),
}).strict();

// ─── Action: completeAuthentication (D6.2) ───────────────────────────────────

export async function completeAuthentication(rawData: unknown): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'AuthenticationRequest')) {
    return { success: false, error: 'Admin access required' };
  }

  const parsed = completeAuthSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { requestId, result, resultNotes, authenticatorId } = parsed.data;

  const [req] = await db
    .select()
    .from(authenticationRequest)
    .where(eq(authenticationRequest.id, requestId))
    .limit(1);

  if (!req) return { success: false, error: 'Authentication request not found' };
  if (req.status !== 'EXPERT_PENDING') {
    return { success: false, error: 'Request is not in EXPERT_PENDING status' };
  }

  const initiator = req.initiator as 'BUYER' | 'SELLER';
  const split = calculateAuthCostSplit(initiator, result, req.totalFeeCents);
  const now = new Date();

  if (result === 'AUTHENTICATED') {
    const certUrl = `https://twicely.co/verify/${req.certificateNumber ?? ''}`;
    await db.update(authenticationRequest).set({
      status: 'EXPERT_AUTHENTICATED',
      completedAt: now,
      expiresAt: null,
      buyerFeeCents: split.buyerShareCents,
      sellerFeeCents: split.sellerShareCents,
      certificateUrl: certUrl,
      resultNotes: resultNotes ?? null,
      authenticatorId: authenticatorId ?? null,
      updatedAt: now,
    }).where(eq(authenticationRequest.id, requestId));

    await db.update(listing).set({
      authenticationStatus: 'EXPERT_AUTHENTICATED',
      updatedAt: now,
    }).where(eq(listing.id, req.listingId));

  } else if (result === 'COUNTERFEIT') {
    const refundedBuyer = initiator === 'BUYER' ? req.totalFeeCents : 0;
    await db.update(authenticationRequest).set({
      status: 'EXPERT_COUNTERFEIT',
      completedAt: now,
      buyerFeeCents: 0,
      sellerFeeCents: req.totalFeeCents,
      refundedBuyerCents: refundedBuyer,
      resultNotes: resultNotes ?? null,
      authenticatorId: authenticatorId ?? null,
      updatedAt: now,
    }).where(eq(authenticationRequest.id, requestId));

    await db.update(listing).set({
      authenticationStatus: 'EXPERT_COUNTERFEIT',
      enforcementState: 'REMOVED',
      updatedAt: now,
    }).where(eq(listing.id, req.listingId));

    await db.insert(auditEvent).values({
      actorType: 'PLATFORM_STAFF',
      actorId: session.staffUserId,
      action: 'COUNTERFEIT_DETECTED',
      subject: 'Listing',
      subjectId: req.listingId,
      severity: 'HIGH',
      detailsJson: { authRequestId: requestId, sellerId: req.sellerId },
    });

  }
  // NOTE: INCONCLUSIVE result handling will be added with AI tier (G10.2).
  // Expert tier only produces AUTHENTICATED or COUNTERFEIT per spec (Feature Lock-in Addendum §48).

  revalidatePath(`/i/${req.listingId}`);
  return { success: true };
}

// ─── Action: invalidateCertificate (D6.3) ───────────────────────────────────

export async function invalidateCertificate(rawData: unknown): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'AuthenticationRequest')) {
    return { success: false, error: 'Admin access required' };
  }

  const parsed = invalidateCertSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { listingId, reason } = parsed.data;

  const revokedReasons = ['ADMIN_REVOKED', 'FRAUD_DETECTED'] as const;
  const newStatus = (revokedReasons as readonly string[]).includes(reason)
    ? 'CERTIFICATE_REVOKED'
    : 'CERTIFICATE_EXPIRED';

  const authenticatedStatuses = [...AUTH_STATUS_AUTHENTICATED];

  await db
    .update(authenticationRequest)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(
      and(
        eq(authenticationRequest.listingId, listingId),
        inArray(authenticationRequest.status, authenticatedStatuses)
      )
    );

  await db
    .update(listing)
    .set({ authenticationStatus: newStatus, authenticationRequestId: null, updatedAt: new Date() })
    .where(eq(listing.id, listingId));

  await db.insert(auditEvent).values({
    actorType: 'PLATFORM_STAFF',
    actorId: session.staffUserId,
    action: 'CERTIFICATE_INVALIDATED',
    subject: 'Listing',
    subjectId: listingId,
    severity: 'MEDIUM',
    detailsJson: { reason },
  });

  return { success: true };
}
