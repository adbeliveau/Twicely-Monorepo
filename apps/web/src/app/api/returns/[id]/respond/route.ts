import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize } from '@twicely/casl/authorize';
import { sub } from '@twicely/casl';
import { respondToReturn } from '@twicely/commerce/returns';
import { db } from '@twicely/db';
import { returnRequest, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const respondToReturnSchema = z.object({
  approved: z.boolean(),
  response: z.string().min(1).max(2000).optional(),
}).strict();

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: returnId } = await params;
    const { session, ability } = await authorize();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the return to get ownership fields for scoped CASL check
    const [ret] = await db
      .select({
        id: returnRequest.id,
        sellerId: order.sellerId,
      })
      .from(returnRequest)
      .innerJoin(order, eq(returnRequest.orderId, order.id))
      .where(eq(returnRequest.id, returnId))
      .limit(1);

    if (!ret) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 });
    }

    if (!ability.can('update', sub('Return', { sellerId: ret.sellerId }))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = respondToReturnSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const result = await respondToReturn({
      sellerId: session.userId,
      returnId,
      approved: parsed.data.approved,
      response: parsed.data.response,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error responding to return', { error });
    return NextResponse.json(
      { error: 'Failed to respond to return' },
      { status: 500 }
    );
  }
}
