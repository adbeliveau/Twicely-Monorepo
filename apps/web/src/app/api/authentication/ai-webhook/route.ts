/**
 * AI authentication provider webhook endpoint.
 * POST /api/authentication/ai-webhook
 *
 * No session/CASL auth — authenticated via HMAC signature verification only.
 * Idempotent: unknown providerRef and already-completed requests return 200.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { authenticationRequest, listing, auditEvent } from '@twicely/db/schema';
import { logger } from '@twicely/logger';
import { getAiAuthProvider } from '@/lib/authentication/ai-provider-factory';
import { calculateAuthCostSplit } from '@/lib/authentication/cost-split';
import { notifyAuthResult } from '@/lib/authentication/auth-notifier';

const SIGNATURE_HEADER = 'X-Entrupy-Signature';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();

  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  let aiProvider;
  try {
    aiProvider = await getAiAuthProvider();
  } catch (err) {
    logger.error('[ai-webhook] Failed to load AI provider', { err });
    return NextResponse.json({ error: 'Provider unavailable' }, { status: 500 });
  }

  if (!aiProvider.verifyWebhookSignature(rawBody, signature)) {
    logger.warn('[ai-webhook] Signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let result;
  try {
    result = aiProvider.parseWebhookResult(rawBody);
  } catch (err) {
    logger.error('[ai-webhook] Failed to parse webhook payload', { err });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Look up the authentication request by providerRef
  const [req] = await db
    .select({
      id: authenticationRequest.id,
      listingId: authenticationRequest.listingId,
      sellerId: authenticationRequest.sellerId,
      buyerId: authenticationRequest.buyerId,
      initiator: authenticationRequest.initiator,
      tier: authenticationRequest.tier,
      status: authenticationRequest.status,
      totalFeeCents: authenticationRequest.totalFeeCents,
    })
    .from(authenticationRequest)
    .where(eq(authenticationRequest.providerRef, result.providerRef))
    .limit(1);

  // Unknown providerRef — idempotent 200
  if (!req) {
    logger.info('[ai-webhook] No request found for providerRef', { providerRef: result.providerRef });
    return NextResponse.json({ ok: true });
  }

  // Already completed — idempotent 200
  const completedStatuses = [
    'AI_AUTHENTICATED', 'AI_INCONCLUSIVE', 'AI_COUNTERFEIT',
    'CERTIFICATE_EXPIRED', 'CERTIFICATE_REVOKED',
  ];
  if (completedStatuses.includes(req.status)) {
    logger.info('[ai-webhook] Duplicate webhook for completed request', { requestId: req.id });
    return NextResponse.json({ ok: true });
  }

  // Fetch listing title for notification
  const [listingRow] = await db
    .select({ title: listing.title })
    .from(listing)
    .where(eq(listing.id, req.listingId))
    .limit(1);
  const itemTitle = listingRow?.title ?? 'your listing';

  const now = new Date();
  const initiator = req.initiator as 'BUYER' | 'SELLER';

  if (result.status === 'INCONCLUSIVE') {
    // Twicely absorbs cost — 0/0 split
    await db.update(authenticationRequest).set({
      status: 'AI_INCONCLUSIVE',
      completedAt: now,
      buyerFeeCents: 0,
      sellerFeeCents: 0,
      resultNotes: result.resultNotes,
      resultJson: result.resultJson,
      updatedAt: now,
    }).where(eq(authenticationRequest.id, req.id));

    await db.update(listing).set({
      authenticationStatus: 'AI_INCONCLUSIVE',
      updatedAt: now,
    }).where(eq(listing.id, req.listingId));

    await db.insert(auditEvent).values({
      actorType: 'SYSTEM',
      actorId: 'ai-webhook',
      action: 'AI_AUTH_INCONCLUSIVE',
      subject: 'AuthenticationRequest',
      subjectId: req.id,
      severity: 'LOW',
      detailsJson: { listingId: req.listingId, confidence: result.confidence },
    });

    void notifyAuthResult(req.sellerId, req.buyerId, req.listingId, itemTitle, 'INCONCLUSIVE', result.confidence);

  } else if (result.status === 'AUTHENTICATED') {
    const split = calculateAuthCostSplit(initiator, 'AUTHENTICATED', req.totalFeeCents);
    const certUrl = await db
      .select({ verifyUrl: authenticationRequest.verifyUrl })
      .from(authenticationRequest)
      .where(eq(authenticationRequest.id, req.id))
      .limit(1)
      .then((rows) => rows[0]?.verifyUrl ?? null);

    await db.update(authenticationRequest).set({
      status: 'AI_AUTHENTICATED',
      completedAt: now,
      buyerFeeCents: split.buyerShareCents,
      sellerFeeCents: split.sellerShareCents,
      certificateUrl: certUrl,
      resultNotes: result.resultNotes,
      resultJson: result.resultJson,
      updatedAt: now,
    }).where(eq(authenticationRequest.id, req.id));

    await db.update(listing).set({
      authenticationStatus: 'AI_AUTHENTICATED',
      updatedAt: now,
    }).where(eq(listing.id, req.listingId));

    void notifyAuthResult(req.sellerId, req.buyerId, req.listingId, itemTitle, 'AUTHENTICATED', result.confidence);

  } else if (result.status === 'COUNTERFEIT') {
    const split = calculateAuthCostSplit(initiator, 'COUNTERFEIT', req.totalFeeCents);

    await db.update(authenticationRequest).set({
      status: 'AI_COUNTERFEIT',
      completedAt: now,
      buyerFeeCents: split.buyerShareCents,
      sellerFeeCents: split.sellerShareCents,
      refundedBuyerCents: initiator === 'BUYER' ? req.totalFeeCents : 0,
      resultNotes: result.resultNotes,
      resultJson: result.resultJson,
      updatedAt: now,
    }).where(eq(authenticationRequest.id, req.id));

    await db.update(listing).set({
      authenticationStatus: 'AI_COUNTERFEIT',
      enforcementState: 'REMOVED',
      updatedAt: now,
    }).where(eq(listing.id, req.listingId));

    await db.insert(auditEvent).values({
      actorType: 'SYSTEM',
      actorId: 'ai-webhook',
      action: 'COUNTERFEIT_DETECTED',
      subject: 'Listing',
      subjectId: req.listingId,
      severity: 'HIGH',
      detailsJson: { authRequestId: req.id, sellerId: req.sellerId },
    });

    void notifyAuthResult(req.sellerId, req.buyerId, req.listingId, itemTitle, 'COUNTERFEIT', result.confidence);
  }

  return NextResponse.json({ ok: true });
}
