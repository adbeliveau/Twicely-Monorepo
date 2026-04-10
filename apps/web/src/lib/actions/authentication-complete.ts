'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@twicely/db';
import { authenticationRequest, listing, auditEvent, ledgerEntry } from '@twicely/db/schema';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { sub } from '@twicely/casl';
import { calculateAuthCostSplit } from '@/lib/authentication/cost-split';
import { AUTH_STATUS_AUTHENTICATED } from '@/lib/authentication/constants';

interface ActionResult {
  success: boolean;
  error?: string;
}

const completeAuthSchema = z.object({
  requestId: z.string().cuid2(),
  result: z.enum(['AUTHENTICATED', 'COUNTERFEIT', 'INCONCLUSIVE']),
  resultNotes: z.string().max(5000).optional(),
  authenticatorId: z.string().cuid2().optional(),
}).strict();

const invalidateCertSchema = z.object({
  listingId: z.string().cuid2(),
  reason: z.enum(['RELISTED', 'LISTING_ENDED', 'ADMIN_REVOKED', 'FRAUD_DETECTED']),
}).strict();

// ─── Action: completeAuthentication (D6.2 + G10.2) ──────────────────────────

export async function completeAuthentication(rawData: unknown): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!session) return { success: false, error: 'Staff access required' };
  const parsed = completeAuthSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { requestId, result, resultNotes, authenticatorId } = parsed.data;

  const [req] = await db
    .select()
    .from(authenticationRequest)
    .where(eq(authenticationRequest.id, requestId))
    .limit(1);

  if (!req) return { success: false, error: 'Authentication request not found' };

  if (!ability.can('manage', sub('AuthenticationRequest', { id: req.id, sellerId: req.sellerId }))) {
    return { success: false, error: 'Admin access required' };
  }

  const isPending = req.status === 'EXPERT_PENDING' || req.status === 'AI_PENDING';
  if (!isPending) {
    return { success: false, error: 'Request is not in EXPERT_PENDING status' };
  }

  // INCONCLUSIVE is AI-only — Expert tier always commits to AUTHENTICATED or COUNTERFEIT
  if (result === 'INCONCLUSIVE' && req.tier !== 'AI') {
    return { success: false, error: 'INCONCLUSIVE result is only valid for AI tier requests' };
  }

  const initiator = req.initiator as 'BUYER' | 'SELLER';
  const now = new Date();
  const isAi = req.tier === 'AI';

  if (result === 'INCONCLUSIVE') {
    // Twicely absorbs cost — 0/0, listing not removed
    await db.update(authenticationRequest).set({
      status: 'AI_INCONCLUSIVE',
      completedAt: now,
      buyerFeeCents: 0,
      sellerFeeCents: 0,
      resultNotes: resultNotes ?? null,
      authenticatorId: authenticatorId ?? null,
      updatedAt: now,
    }).where(eq(authenticationRequest.id, requestId));

    await db.update(listing).set({
      authenticationStatus: 'AI_INCONCLUSIVE',
      updatedAt: now,
    }).where(eq(listing.id, req.listingId));

    await db.insert(auditEvent).values({
      actorType: 'PLATFORM_STAFF',
      actorId: session.staffUserId,
      action: 'AI_AUTH_INCONCLUSIVE',
      subject: 'AuthenticationRequest',
      subjectId: requestId,
      severity: 'LOW',
      detailsJson: { listingId: req.listingId },
    });

  } else if (result === 'AUTHENTICATED') {
    const split = calculateAuthCostSplit(initiator, 'AUTHENTICATED', req.totalFeeCents);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';
    const certUrl = `${baseUrl}/verify/${req.certificateNumber ?? ''}`;
    const newStatus = isAi ? 'AI_AUTHENTICATED' : 'EXPERT_AUTHENTICATED';

    await db.update(authenticationRequest).set({
      status: newStatus,
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
      authenticationStatus: newStatus,
      updatedAt: now,
    }).where(eq(listing.id, req.listingId));

    // Post AUTH_FEE ledger entries — seller share deducted from proceeds
    if (split.sellerShareCents > 0) {
      await db.insert(ledgerEntry).values({
        type: 'AUTH_FEE_SELLER',
        status: 'POSTED',
        amountCents: -split.sellerShareCents,
        userId: req.sellerId,
        listingId: req.listingId,
        idempotencyKey: `auth-fee:${requestId}:seller`,
        postedAt: now,
      });
    }
    // Buyer fee is already posted at checkout (checkout-finalize.ts).
    // Post buyer ledger only for seller-initiated requests where buyer didn't pay at checkout.
    if (split.buyerShareCents > 0 && req.buyerId && initiator === 'SELLER') {
      await db.insert(ledgerEntry).values({
        type: 'AUTH_FEE_BUYER',
        status: 'POSTED',
        amountCents: -split.buyerShareCents,
        userId: req.buyerId,
        listingId: req.listingId,
        idempotencyKey: `auth-fee:${requestId}:buyer`,
        postedAt: now,
      });
    }

  } else if (result === 'COUNTERFEIT') {
    const refundedBuyer = initiator === 'BUYER' ? req.totalFeeCents : 0;
    const newStatus = isAi ? 'AI_COUNTERFEIT' : 'EXPERT_COUNTERFEIT';

    await db.update(authenticationRequest).set({
      status: newStatus,
      completedAt: now,
      buyerFeeCents: 0,
      sellerFeeCents: req.totalFeeCents,
      refundedBuyerCents: refundedBuyer,
      resultNotes: resultNotes ?? null,
      authenticatorId: authenticatorId ?? null,
      updatedAt: now,
    }).where(eq(authenticationRequest.id, requestId));

    await db.update(listing).set({
      authenticationStatus: newStatus,
      enforcementState: 'REMOVED',
      updatedAt: now,
    }).where(eq(listing.id, req.listingId));

    // Post AUTH_FEE_SELLER ledger — seller pays full fee for counterfeit
    if (req.totalFeeCents > 0) {
      await db.insert(ledgerEntry).values({
        type: 'AUTH_FEE_SELLER',
        status: 'POSTED',
        amountCents: -req.totalFeeCents,
        userId: req.sellerId,
        listingId: req.listingId,
        idempotencyKey: `auth-fee:${requestId}:seller-counterfeit`,
        postedAt: now,
      });
    }

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

  revalidatePath(`/i/${req.listingId}`);
  return { success: true };
}

// ─── Action: invalidateCertificate (D6.3) ───────────────────────────────────

export async function invalidateCertificate(rawData: unknown): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!session) return { success: false, error: 'Staff access required' };

  const parsed = invalidateCertSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { listingId, reason } = parsed.data;

  if (!ability.can('manage', sub('AuthenticationRequest', { listingId }))) {
    return { success: false, error: 'Admin access required' };
  }

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
