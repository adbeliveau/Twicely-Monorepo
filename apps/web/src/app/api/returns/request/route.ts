import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize } from '@twicely/casl/authorize';
import { createReturnRequest } from '@twicely/commerce/returns';
import { logger } from '@twicely/logger';

const createReturnSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  reason: z.enum(['INAD', 'DAMAGED', 'INR', 'COUNTERFEIT', 'REMORSE', 'WRONG_ITEM']),
  description: z.string().min(1, 'Description is required'),
  photos: z.array(z.string().url()).max(10).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const { session, ability } = await authorize();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ability.can('create', 'Return')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createReturnSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const result = await createReturnRequest({
      buyerId: session.userId,
      orderId: parsed.data.orderId,
      reason: parsed.data.reason,
      description: parsed.data.description,
      evidencePhotos: parsed.data.photos ?? [],
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ returnId: result.returnRequestId });
  } catch (error) {
    logger.error('Error creating return request', { error });
    return NextResponse.json(
      { error: 'Failed to create return request' },
      { status: 500 }
    );
  }
}
