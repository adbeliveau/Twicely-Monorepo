/**
 * POST /api/messaging/typing
 *
 * Publishes a typing indicator to the conversation's Centrifugo channel.
 * Returns 200 silently for READ_ONLY conversations (no-op).
 * Returns 403 if user is not a participant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize } from '@twicely/casl/authorize';
import { db } from '@twicely/db';
import { conversation } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { publishToChannel } from '@twicely/realtime/centrifugo-publisher';
import { conversationChannel, MESSAGING_EVENTS } from '@twicely/realtime/messaging-channels';

const typingSchema = z.object({
  conversationId: z.string().min(1).max(100),
}).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, ability } = await authorize();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!ability.can('create', 'Message')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = typingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const { conversationId } = parsed.data;

  const [conv] = await db
    .select({
      buyerId: conversation.buyerId,
      sellerId: conversation.sellerId,
      status: conversation.status,
    })
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

  // READ_ONLY: silently succeed without publishing
  if (conv.status === 'READ_ONLY') {
    return NextResponse.json({ success: true });
  }

  // OPEN: publish typing event
  if (conv.status === 'OPEN') {
    await publishToChannel(conversationChannel(conversationId), {
      type: MESSAGING_EVENTS.TYPING,
      userId: session.userId,
    });
  }

  return NextResponse.json({ success: true });
}
