/**
 * POST /api/realtime/subscribe
 *
 * Issues a Centrifugo subscription token for the requesting user.
 * Validates channel participation before issuing the token.
 *
 * Allowed channels:
 *   - private-conversation.{cuid2} — user must be a participant
 *   - private-user.{userId}        — user must be subscribing for their own ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { z } from 'zod';
import { authorize } from '@twicely/casl/authorize';
import { db } from '@twicely/db';
import { conversation } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

const subscribeSchema = z.object({
  channel: z.string().min(1).max(200),
}).strict();

function getSecret(): string | null {
  return process.env.CENTRIFUGO_TOKEN_HMAC_SECRET ?? null;
}

function generateToken(userId: string, channel: string, secret: string): string {
  const payload = JSON.stringify({
    sub: userId,
    channel,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('hex');
  return `${encodedPayload}.${signature}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, ability } = await authorize();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const secret = getSecret();
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Realtime not configured.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const { channel } = parsed.data;

  // Gate: must be able to read conversations
  if (!ability.can('read', 'Conversation')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Validate conversation channel — user must be a participant
  const convMatch = /^private-conversation\.(.+)$/.exec(channel);
  if (convMatch) {
    const conversationId = convMatch[1]!;

    const [conv] = await db
      .select({ buyerId: conversation.buyerId, sellerId: conversation.sellerId })
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1);

    if (!conv) {
      return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 });
    }

    const isParticipant =
      conv.buyerId === session.userId ||
      conv.sellerId === session.userId ||
      (session.onBehalfOfSellerId != null && conv.sellerId === session.onBehalfOfSellerId);

    if (!isParticipant) {
      return NextResponse.json({ success: false, error: 'Not found.' }, { status: 403 });
    }

    const token = generateToken(session.userId, channel, secret);
    return NextResponse.json({ success: true, token });
  }

  // Validate user channel — user must be subscribing for their own ID
  const userMatch = /^private-user\.(.+)$/.exec(channel);
  if (userMatch) {
    const channelUserId = userMatch[1]!;
    if (channelUserId !== session.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const token = generateToken(session.userId, channel, secret);
    return NextResponse.json({ success: true, token });
  }

  // Validate local transaction channel — user must be buyer or seller
  const localTxMatch = /^private-local-tx\.(.+)$/.exec(channel);
  if (localTxMatch) {
    const transactionId = localTxMatch[1]!;
    const { localTransaction } = await import('@/lib/db/schema');
    const [tx] = await db
      .select({ buyerId: localTransaction.buyerId, sellerId: localTransaction.sellerId })
      .from(localTransaction)
      .where(eq(localTransaction.id, transactionId))
      .limit(1);

    if (!tx) {
      return NextResponse.json({ success: false, error: 'Not found.' }, { status: 404 });
    }
    const isTxParticipant = tx.buyerId === session.userId || tx.sellerId === session.userId;
    if (!isTxParticipant) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const token = generateToken(session.userId, channel, secret);
    return NextResponse.json({ success: true, token });
  }

  // Unknown channel pattern
  return NextResponse.json({ success: false, error: 'Invalid channel.' }, { status: 400 });
}
