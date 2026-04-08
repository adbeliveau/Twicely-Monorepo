import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { stripeEventLog } from '@twicely/db/schema';

// Hardcoded IDs for idempotency
const STRIPE_EVENT_LOG_IDS = {
  paymentSucceeded1: 'seed-sel-001',
  paymentSucceeded7: 'seed-sel-002',
  disputeCreated10:  'seed-sel-003',
};

// Unique Stripe event IDs (must be unique per the stripeEventLog.stripeEventId unique constraint)
const STRIPE_EVENT_IDS = {
  paymentSucceeded1: 'evt_seed_pi_succeeded_order001',
  paymentSucceeded7: 'evt_seed_pi_succeeded_order007',
  disputeCreated10:  'evt_seed_charge_dispute_order010',
};

/**
 * Seed Stripe webhook event log entries.
 * Demonstrates idempotency tracking for payment events.
 * Depends on seedOrders() running first (orders must exist for FK in payloadJson context).
 */
export async function seedStripeEvents(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  await db.insert(stripeEventLog).values([
    {
      id:               STRIPE_EVENT_LOG_IDS.paymentSucceeded1,
      stripeEventId:    STRIPE_EVENT_IDS.paymentSucceeded1,
      eventType:        'payment_intent.succeeded',
      processedAt:      daysAgo(2),
      processingStatus: 'succeeded',
      retryCount:       0,
      payloadJson:      {
        id:     STRIPE_EVENT_IDS.paymentSucceeded1,
        type:   'payment_intent.succeeded',
        data:   {
          object: {
            id:       'pi_seed_order001',
            amount:   90700,
            currency: 'usd',
            metadata: { orderId: 'seed-order-001' },
          },
        },
      },
      createdAt:        daysAgo(2),
    },
    {
      id:               STRIPE_EVENT_LOG_IDS.paymentSucceeded7,
      stripeEventId:    STRIPE_EVENT_IDS.paymentSucceeded7,
      eventType:        'payment_intent.succeeded',
      processedAt:      daysAgo(15),
      processingStatus: 'succeeded',
      retryCount:       0,
      payloadJson:      {
        id:     STRIPE_EVENT_IDS.paymentSucceeded7,
        type:   'payment_intent.succeeded',
        data:   {
          object: {
            id:       'pi_seed_order007',
            amount:   45650,
            currency: 'usd',
            metadata: { orderId: 'seed-order-007' },
          },
        },
      },
      createdAt:        daysAgo(15),
    },
    {
      id:               STRIPE_EVENT_LOG_IDS.disputeCreated10,
      stripeEventId:    STRIPE_EVENT_IDS.disputeCreated10,
      eventType:        'charge.dispute.created',
      processedAt:      daysAgo(2),
      processingStatus: 'succeeded',
      retryCount:       0,
      payloadJson:      {
        id:     STRIPE_EVENT_IDS.disputeCreated10,
        type:   'charge.dispute.created',
        data:   {
          object: {
            id:       'dp_seed_order010',
            amount:   1150500,
            currency: 'usd',
            reason:   'not_as_described',
            metadata: { orderId: 'seed-order-010' },
          },
        },
      },
      createdAt:        daysAgo(2),
    },
  ]).onConflictDoNothing();
}

// Export IDs for use in other seeders
export const STRIPE_EVENT_LOG_SEED_IDS = STRIPE_EVENT_LOG_IDS;
