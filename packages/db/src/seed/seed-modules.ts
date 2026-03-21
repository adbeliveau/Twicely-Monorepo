/**
 * Seed: Module Registry (F1.1)
 * Core platform modules matching V3 tech stack
 */
import { db } from '@twicely/db';
import { moduleRegistry } from '@twicely/db/schema';
import { createId } from '@paralleldrive/cuid2';

const MODULES = [
  {
    moduleId: 'payments.stripe',
    label: 'Stripe Payments',
    description: 'Credit card processing, Connect payouts, and subscription billing',
    state: 'ENABLED' as const,
    version: '1.0.0',
    configPath: '/cfg/stripe',
  },
  {
    moduleId: 'shipping.shippo',
    label: 'Shippo Shipping',
    description: 'Multi-carrier rates, label generation, and package tracking',
    state: 'ENABLED' as const,
    version: '1.0.0',
    configPath: '/cfg/shippo',
  },
  {
    moduleId: 'search.typesense',
    label: 'Typesense Search',
    description: 'Full-text search engine for listings, stores, and categories',
    state: 'ENABLED' as const,
    version: '1.0.0',
    configPath: '/cfg/providers/instances',
  },
  {
    moduleId: 'cache.valkey',
    label: 'Valkey Cache',
    description: 'In-memory caching and session storage',
    state: 'ENABLED' as const,
    version: '1.0.0',
    configPath: '/cfg/providers/instances',
  },
  {
    moduleId: 'realtime.centrifugo',
    label: 'Centrifugo Realtime',
    description: 'WebSocket server for real-time notifications and live updates',
    state: 'ENABLED' as const,
    version: '1.0.0',
    configPath: '/cfg/providers/instances',
  },
  {
    moduleId: 'email.resend',
    label: 'Resend Email',
    description: 'Transactional and marketing email delivery',
    state: 'ENABLED' as const,
    version: '1.0.0',
    configPath: '/cfg/providers/instances',
  },
  {
    moduleId: 'storage.r2',
    label: 'Cloudflare R2 Storage',
    description: 'Object storage for images, assets, and file exports',
    state: 'ENABLED' as const,
    version: '1.0.0',
    configPath: '/cfg/providers/instances',
  },
] as const;

export async function seedModuleRegistry(): Promise<void> {
  for (const mod of MODULES) {
    await db.insert(moduleRegistry).values({
      id: createId(),
      ...mod,
      manifestJson: {},
    }).onConflictDoNothing();
  }
}
