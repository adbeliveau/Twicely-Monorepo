import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  // ─── FIX 1: Migrate stale performance_band data ───────────────
  console.log('[1/3] Migrating stale performance_band values...');

  const updated = await sql`
    UPDATE seller_profile SET performance_band = CASE
      WHEN performance_band::text = 'STANDARD' THEN 'EMERGING'
      WHEN performance_band::text = 'ABOVE_STANDARD' THEN 'ESTABLISHED'
      WHEN performance_band::text = 'BELOW_STANDARD' THEN 'EMERGING'
      ELSE performance_band::text
    END::performance_band
    WHERE performance_band::text IN ('STANDARD', 'ABOVE_STANDARD', 'BELOW_STANDARD')
    RETURNING id, performance_band`;
  console.log(`  Updated ${updated.length} rows.`);

  const updatedPerf = await sql`
    UPDATE seller_performance SET current_band = CASE
      WHEN current_band::text = 'STANDARD' THEN 'EMERGING'
      WHEN current_band::text = 'ABOVE_STANDARD' THEN 'ESTABLISHED'
      WHEN current_band::text = 'BELOW_STANDARD' THEN 'EMERGING'
      ELSE current_band::text
    END::performance_band
    WHERE current_band::text IN ('STANDARD', 'ABOVE_STANDARD', 'BELOW_STANDARD')
    RETURNING id, current_band`;
  console.log(`  Updated ${updatedPerf.length} seller_performance rows.`);

  // ─── FIX 2: buyer_review constraints ───────────────────────────
  console.log('[2/3] Fixing buyer_review constraints...');

  try {
    await sql`ALTER TABLE buyer_review
      ADD CONSTRAINT buyer_review_order_id_unique UNIQUE(order_id)`;
    console.log('  Added order_id unique.');
  } catch (e: any) {
    console.log('  order_id unique:', e.code === '42710' ? 'already exists' : e.message);
  }

  try {
    await sql`ALTER TABLE buyer_review
      ADD CONSTRAINT buyer_review_order_id_order_id_fk
      FOREIGN KEY (order_id) REFERENCES "order"(id)`;
    console.log('  Added order_id FK.');
  } catch (e: any) {
    console.log('  order_id FK:', e.code === '42710' ? 'already exists' : e.message);
  }

  try {
    await sql`ALTER TABLE buyer_review
      ADD CONSTRAINT buyer_review_seller_user_id_user_id_fk
      FOREIGN KEY (seller_user_id) REFERENCES "user"(id)`;
    console.log('  Added seller_user_id FK.');
  } catch (e: any) {
    console.log('  seller_user_id FK:', e.code === '42710' ? 'already exists' : e.message);
  }

  try {
    await sql`ALTER TABLE buyer_review
      ADD CONSTRAINT buyer_review_buyer_user_id_user_id_fk
      FOREIGN KEY (buyer_user_id) REFERENCES "user"(id)`;
    console.log('  Added buyer_user_id FK.');
  } catch (e: any) {
    console.log('  buyer_user_id FK:', e.code === '42710' ? 'already exists' : e.message);
  }

  // ─── FIX 3: watcher_offer FK ──────────────────────────────────
  console.log('[3/3] Fixing watcher_offer FK...');

  try {
    await sql`ALTER TABLE watcher_offer
      ADD CONSTRAINT watcher_offer_listing_id_listing_id_fk
      FOREIGN KEY (listing_id) REFERENCES listing(id) ON DELETE CASCADE`;
    console.log('  Added listing_id FK.');
  } catch (e: any) {
    console.log('  listing_id FK:', e.code === '42710' ? 'already exists' : e.message);
  }

  // ─── VERIFY ────────────────────────────────────────────────────
  console.log('\n=== VERIFICATION ===');

  const bandCheck = await sql`
    SELECT performance_band, COUNT(*) as cnt
    FROM seller_profile GROUP BY performance_band`;
  console.log('performance_band values:', bandCheck);

  const brCheck = await sql`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'buyer_review'
    AND constraint_type IN ('FOREIGN KEY', 'UNIQUE')
    ORDER BY constraint_name`;
  console.log('buyer_review FK/UNIQUE:', brCheck);

  const woCheck = await sql`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'watcher_offer' AND constraint_type = 'FOREIGN KEY'`;
  console.log('watcher_offer FKs:', woCheck);

  console.log('\nDB sync complete.');
  await sql.end();
}

main().catch(async e => {
  console.error('FAILED:', e);
  await sql.end();
  process.exit(1);
});
