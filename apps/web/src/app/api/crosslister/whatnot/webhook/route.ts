/**
 * Whatnot sale webhook endpoint.
 * Endpoint: POST /api/crosslister/whatnot/webhook
 * Source: H2.3 install prompt §2.5; Lister Canonical §13.5, §24.5
 *
 * Authentication: HMAC-SHA256 signature verification only.
 * No session/CASL auth — this is a platform-to-platform webhook.
 *
 * Returns 200 even on handler errors (prevent retry storms per §24.5).
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@twicely/logger';
import { verifyWhatnotSignature, WHATNOT_SIGNATURE_HEADER } from '@twicely/crosslister/connectors/whatnot-webhook-verify';
import { WhatnotWebhookEnvelopeSchema } from '@twicely/crosslister/connectors/whatnot-schemas';
import { handleWhatnotSaleWebhook } from '@twicely/crosslister/handlers/sale-webhook-handler';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Read raw body before any JSON parsing (required for HMAC verification)
  const rawBody = await request.text();

  const signatureHeader = request.headers.get(WHATNOT_SIGNATURE_HEADER);
  if (!signatureHeader) {
    return NextResponse.json({ error: 'Missing signature header' }, { status: 400 });
  }

  // Verify HMAC-SHA256 signature
  const verification = await verifyWhatnotSignature(rawBody, signatureHeader);
  if (!verification.valid) {
    logger.warn('[whatnotWebhookRoute] Signature verification failed', {
      error: verification.error,
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Parse and validate the envelope
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const envelopeResult = WhatnotWebhookEnvelopeSchema.safeParse(parsedBody);
  if (!envelopeResult.success) {
    return NextResponse.json({ error: 'Invalid webhook envelope' }, { status: 400 });
  }

  const envelope = envelopeResult.data;

  // Route by event type
  if (envelope.eventType === 'order.completed') {
    try {
      await handleWhatnotSaleWebhook(envelope);
    } catch (err) {
      // Acknowledge receipt even on handler errors — prevent Whatnot retry storms (§24.5)
      logger.error('[whatnotWebhookRoute] Handler error', {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        error: String(err),
      });
    }
  } else {
    logger.info('[whatnotWebhookRoute] Unhandled event type — acknowledging', {
      eventId: envelope.eventId,
      eventType: envelope.eventType,
    });
  }

  return NextResponse.json({ received: true });
}
