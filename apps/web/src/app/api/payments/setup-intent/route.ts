import { NextResponse } from 'next/server';
import { authorize, sub } from '@twicely/casl';
import { db } from '@twicely/db';
import { user as userTable } from '@twicely/db/schema';
import { stripe } from '@twicely/stripe/server';
import { eq } from 'drizzle-orm';

// Internal helper — get or create Stripe Customer for the authenticated user
async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const [userRow] = await db
    .select({ stripeCustomerId: userTable.stripeCustomerId })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (userRow?.stripeCustomerId) {
    return userRow.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId, platform: 'twicely' },
  });

  await db
    .update(userTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(userTable.id, userId));

  return customer.id;
}

export async function POST(): Promise<NextResponse> {
  const { session, ability } = await authorize();

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!ability.can('update', sub('User', { id: session.userId }))) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { getValkeyClient } = await import('@twicely/db/cache');
    const valkey = getValkeyClient();
    const key = `setup-intent-rate:${session.userId}`;
    const count = await valkey.incr(key);
    if (count === 1) await valkey.expire(key, 60);
    if (count > 5) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
  } catch { /* fail open */ }

  try {
    const customerId = await getOrCreateStripeCustomer(session.userId, session.email);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    return NextResponse.json({
      success: true,
      clientSecret: setupIntent.client_secret,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create setup intent';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
