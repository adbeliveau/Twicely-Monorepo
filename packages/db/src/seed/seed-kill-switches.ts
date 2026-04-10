/**
 * Seed kill switches and launch gates into the featureFlag table.
 *
 * Kill switches (kill.*) — start ENABLED (feature is active).
 *   Disabling a kill switch disables the feature.
 *
 * Launch gates (gate.*) — start DISABLED (gate is closed, feature not yet launched).
 *   Enabling a launch gate opens the feature for production traffic.
 *
 * Idempotent: uses onConflictDoNothing on the unique key column.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { featureFlag } from '../schema';
import { SEED_IDS } from './seed-system';

interface FlagSeed {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
}

const KILL_SWITCHES: FlagSeed[] = [
  {
    key: 'kill.checkout',
    name: 'Checkout',
    description: 'Disables the checkout flow — buyers cannot complete purchases',
    enabled: true,
  },
  {
    key: 'kill.crosslister',
    name: 'Crosslister',
    description: 'Disables all crosslister operations (publish, import, sync)',
    enabled: true,
  },
  {
    key: 'kill.messaging',
    name: 'Messaging',
    description: 'Disables buyer-seller messaging',
    enabled: true,
  },
  {
    key: 'kill.offers',
    name: 'Offers',
    description: 'Disables the offer/counter-offer system',
    enabled: true,
  },
  {
    key: 'kill.payouts',
    name: 'Payouts',
    description: 'Halts all payout processing',
    enabled: true,
  },
  {
    key: 'kill.search',
    name: 'Search',
    description: 'Disables search engine (falls back to PostgreSQL ILIKE)',
    enabled: true,
  },
  {
    key: 'kill.local',
    name: 'Twicely.Local',
    description: 'Disables local pickup transactions',
    enabled: true,
  },
  {
    key: 'kill.reviews',
    name: 'Reviews',
    description: 'Disables review submission',
    enabled: true,
  },
  {
    key: 'kill.registrations',
    name: 'New Registrations',
    description: 'Prevents new user sign-ups',
    enabled: true,
  },
  {
    key: 'kill.listings.create',
    name: 'Listing Creation',
    description: 'Prevents creation of new listings',
    enabled: true,
  },
  {
    key: 'kill.stripe.webhooks',
    name: 'Stripe Webhooks',
    description: 'Disables Stripe webhook processing',
    enabled: true,
  },
  {
    key: 'kill.notifications.email',
    name: 'Email Notifications',
    description: 'Disables outbound email delivery',
    enabled: true,
  },
];

const LAUNCH_GATES: FlagSeed[] = [
  {
    key: 'gate.marketplace',
    name: 'Marketplace',
    description: 'Main marketplace is live and accepting traffic',
    enabled: false,
  },
  {
    key: 'gate.crosslister',
    name: 'Crosslister',
    description: 'Crosslister module is live',
    enabled: false,
  },
  {
    key: 'gate.local',
    name: 'Twicely.Local',
    description: 'Local pickup feature is live',
    enabled: false,
  },
  {
    key: 'gate.helpdesk',
    name: 'Helpdesk',
    description: 'Customer support helpdesk is live',
    enabled: false,
  },
  {
    key: 'gate.affiliates',
    name: 'Affiliates',
    description: 'Affiliate program is accepting signups',
    enabled: false,
  },
  {
    key: 'gate.authentication',
    name: 'Item Authentication',
    description: 'Tier 1 photo auth is live',
    enabled: false,
  },
  {
    key: 'gate.financial.center',
    name: 'Financial Center',
    description: 'Seller financial tools are live',
    enabled: false,
  },
  {
    key: 'gate.store.subscriptions',
    name: 'Store Subscriptions',
    description: 'Paid store tiers are available for purchase',
    enabled: false,
  },
  {
    key: 'gate.opensearch',
    name: 'OpenSearch',
    description: 'Routes search reads to OpenSearch instead of Typesense (percentage rollout supported)',
    enabled: false,
  },
];

export async function seedKillSwitches(db: PostgresJsDatabase): Promise<void> {
  const allFlags = [...KILL_SWITCHES, ...LAUNCH_GATES];

  for (const flag of allFlags) {
    await db.insert(featureFlag).values({
      key: flag.key,
      name: flag.name,
      description: flag.description,
      type: 'BOOLEAN',
      enabled: flag.enabled,
      percentage: null,
      targetingJson: {},
      createdByStaffId: SEED_IDS.staffAdminId,
    }).onConflictDoNothing();
  }
}
