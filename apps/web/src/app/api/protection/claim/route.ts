import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize } from '@twicely/casl/authorize';
import { createProtectionClaim } from '@twicely/commerce/buyer-protection';
import { logger } from '@twicely/logger';

const claimSchema = z.object({
  orderId: z.string().min(1),
  reason: z.enum(['INAD', 'DAMAGED', 'WRONG_ITEM', 'INR', 'COUNTERFEIT']),
  description: z.string().min(1),
  photos: z.array(z.string().url()).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const { session, ability } = await authorize();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ability.can('create', 'Dispute')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = claimSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { orderId, reason, description, photos } = parsed.data;

    const result = await createProtectionClaim({
      buyerId: session.userId,
      orderId,
      reason,
      description,
      photos: photos ?? [],
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ claimId: result.claimId });
  } catch (error) {
    logger.error('Error creating protection claim', { error });
    return NextResponse.json(
      { error: 'Failed to create protection claim' },
      { status: 500 }
    );
  }
}
