import { NextResponse } from 'next/server';
import { authorize, sub } from '@twicely/casl';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';

/**
 * GET /api/local/tokens?transactionId=...
 *
 * Returns the preloaded dual tokens for a local transaction.
 * Only the buyer or seller of the transaction may access.
 * Used to preload tokens into IndexedDB at escrow creation.
 */
export async function GET(request: Request) {
  const { session, ability } = await authorize();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get('transactionId');

  if (!transactionId) {
    return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
  }

  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, transactionId))
    .limit(1);

  if (!tx) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isBuyer = session.userId === tx.buyerId;
  const isSeller = session.userId === tx.sellerId;

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (isBuyer && !ability.can('read', sub('LocalTransaction', { buyerId: tx.buyerId }))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (isSeller && !ability.can('read', sub('LocalTransaction', { sellerId: tx.sellerId }))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  logger.info('[local-tokens] Token preload requested', {
    transactionId,
    userId: session.userId,
  });

  // H3 Security: Return only the requesting party's token, not both
  if (isBuyer) {
    return NextResponse.json({
      buyerToken: tx.buyerConfirmationCode,
      buyerOfflineCode: tx.buyerOfflineCode,
      transactionId: tx.id,
      scheduledAt: tx.scheduledAt?.toISOString() ?? null,
    });
  }

  return NextResponse.json({
    sellerToken: tx.sellerConfirmationCode,
    sellerOfflineCode: tx.sellerOfflineCode,
    transactionId: tx.id,
    scheduledAt: tx.scheduledAt?.toISOString() ?? null,
  });
}
