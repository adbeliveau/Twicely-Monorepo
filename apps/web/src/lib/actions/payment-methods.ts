'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { db } from '@twicely/db';
import { user as userTable } from '@twicely/db/schema';
import { stripe } from '@twicely/stripe/server';
import type Stripe from 'stripe';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RemovePaymentMethodSchema = z.object({
  paymentMethodId: zodId,
}).strict();

const SetDefaultSchema = z.object({
  paymentMethodId: zodId,
}).strict();

// ─── Internal helper (NOT exported) ──────────────────────────────────────────

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

function serializePaymentMethod(
  pm: Stripe.PaymentMethod,
  defaultPmId: string | null,
): SerializedPaymentMethod {
  const card = pm.card;
  return {
    id: pm.id,
    brand: card?.brand ?? 'unknown',
    last4: card?.last4 ?? '????',
    expMonth: card?.exp_month ?? 0,
    expYear: card?.exp_year ?? 0,
    isDefault: pm.id === defaultPmId,
  };
}

// ─── listPaymentMethods ───────────────────────────────────────────────────────

export async function listPaymentMethods(): Promise<{
  success: boolean;
  paymentMethods: SerializedPaymentMethod[];
  defaultPaymentMethodId: string | null;
  error?: string;
}> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, paymentMethods: [], defaultPaymentMethodId: null };
  }

  if (!ability.can('read', sub('User', { id: session.userId }))) {
    return { success: false, paymentMethods: [], defaultPaymentMethodId: null, error: 'Forbidden' };
  }

  try {
    const [userRow] = await db
      .select({ stripeCustomerId: userTable.stripeCustomerId })
      .from(userTable)
      .where(eq(userTable.id, session.userId))
      .limit(1);

    if (!userRow?.stripeCustomerId) {
      return { success: true, paymentMethods: [], defaultPaymentMethodId: null };
    }

    const customerId = userRow.stripeCustomerId;

    const [pmList, customer] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: 'card' }),
      stripe.customers.retrieve(customerId),
    ]);

    if (customer.deleted) {
      return { success: true, paymentMethods: [], defaultPaymentMethodId: null };
    }

    const defaultPmId =
      typeof customer.invoice_settings?.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : (customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null)?.id ?? null;

    const paymentMethods = pmList.data.map((pm) => serializePaymentMethod(pm, defaultPmId));

    return { success: true, paymentMethods, defaultPaymentMethodId: defaultPmId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load payment methods';
    return { success: false, paymentMethods: [], defaultPaymentMethodId: null, error: message };
  }
}

// ─── createSetupIntent ────────────────────────────────────────────────────────

export async function createSetupIntent(): Promise<{
  success: boolean;
  clientSecret?: string;
  error?: string;
}> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', sub('User', { id: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(session.userId, session.email);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    return { success: true, clientSecret: setupIntent.client_secret ?? undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create setup intent';
    return { success: false, error: message };
  }
}

// ─── removePaymentMethod ──────────────────────────────────────────────────────

export async function removePaymentMethod(paymentMethodId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Forbidden' };
  }

  if (!ability.can('update', sub('User', { id: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = RemovePaymentMethodSchema.safeParse({ paymentMethodId });
  if (!parsed.success) {
    return { success: false, error: 'Invalid payment method ID' };
  }

  const [userRow] = await db
    .select({ stripeCustomerId: userTable.stripeCustomerId })
    .from(userTable)
    .where(eq(userTable.id, session.userId))
    .limit(1);

  if (!userRow?.stripeCustomerId) {
    return { success: false, error: 'No payment methods on file' };
  }

  const customerId = userRow.stripeCustomerId;

  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    // IDOR guard: verify the PM belongs to this user's Stripe Customer
    if (pm.customer !== customerId) {
      return { success: false, error: 'Payment method not found' };
    }

    await stripe.paymentMethods.detach(paymentMethodId);

    revalidatePath('/my/settings/payments');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove payment method';
    return { success: false, error: message };
  }
}

// ─── setDefaultPaymentMethod ──────────────────────────────────────────────────

export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Forbidden' };
  }

  if (!ability.can('update', sub('User', { id: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = SetDefaultSchema.safeParse({ paymentMethodId });
  if (!parsed.success) {
    return { success: false, error: 'Invalid payment method ID' };
  }

  const [userRow] = await db
    .select({ stripeCustomerId: userTable.stripeCustomerId })
    .from(userTable)
    .where(eq(userTable.id, session.userId))
    .limit(1);

  if (!userRow?.stripeCustomerId) {
    return { success: false, error: 'No payment methods on file' };
  }

  const customerId = userRow.stripeCustomerId;

  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    // IDOR guard: verify the PM belongs to this user's Stripe Customer
    if (pm.customer !== customerId) {
      return { success: false, error: 'Payment method not found' };
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    revalidatePath('/my/settings/payments');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set default payment method';
    return { success: false, error: message };
  }
}
