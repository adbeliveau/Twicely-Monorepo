/**
 * C2a Schema Migration: Offer System
 * Run with: npx tsx scripts/apply-offer-migration.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not set');
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log('Applying C2a offer system migration...');

  // 1. Create offer_type enum
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE offer_type AS ENUM ('BEST_OFFER', 'WATCHER_OFFER', 'BUNDLE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log('✓ Created offer_type enum');

  // 2. Add offerExpiryHours to listing table
  await db.execute(sql`
    ALTER TABLE listing
    ADD COLUMN IF NOT EXISTS offer_expiry_hours INTEGER;
  `);
  console.log('✓ Added offer_expiry_hours to listing');

  // 3. Modify listing_offer table - add new columns
  await db.execute(sql`
    ALTER TABLE listing_offer
    ADD COLUMN IF NOT EXISTS type offer_type NOT NULL DEFAULT 'BEST_OFFER';
  `);
  await db.execute(sql`
    ALTER TABLE listing_offer
    ADD COLUMN IF NOT EXISTS parent_offer_id TEXT;
  `);
  await db.execute(sql`
    ALTER TABLE listing_offer
    ADD COLUMN IF NOT EXISTS counter_by_role TEXT;
  `);
  console.log('✓ Added counter chain columns to listing_offer');

  // 4. Drop old flat counter columns
  await db.execute(sql`
    ALTER TABLE listing_offer
    DROP COLUMN IF EXISTS counter_offer_cents;
  `);
  await db.execute(sql`
    ALTER TABLE listing_offer
    DROP COLUMN IF EXISTS counter_message;
  `);
  console.log('✓ Dropped old flat counter columns');

  // 5. Add index on parent_offer_id
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS lo_parent_offer ON listing_offer (parent_offer_id);
  `);
  console.log('✓ Added parent_offer_id index');

  // 6. Create watcher_offer table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS watcher_offer (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL,
      discounted_price_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      expires_at TIMESTAMPTZ NOT NULL,
      watchers_notified_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS wo_listing ON watcher_offer (listing_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS wo_seller ON watcher_offer (seller_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS wo_expires ON watcher_offer (expires_at);`);
  console.log('✓ Created watcher_offer table');

  console.log('\n✓ C2a migration complete!');
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
