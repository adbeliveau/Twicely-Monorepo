import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  console.log('=== D1a HOTFIX: storefrontCustomCategory FK fix ===\n');
  console.log('Changing seller_id (sellerProfile.id) → user_id (user.id)');
  console.log('Per User Model §5: all ownership resolves to userId\n');

  // ─── 1. Drop old index ─────────────────────────────────────────────
  console.log('[1/5] Dropping old index scc_seller...');
  try {
    await sql`DROP INDEX IF EXISTS scc_seller`;
    console.log('  Dropped.');
  } catch (e: any) {
    console.log('  Index not found or already dropped.');
  }

  // ─── 2. Drop old FK constraint ─────────────────────────────────────
  console.log('[2/5] Dropping old FK constraint...');
  // Find and drop the constraint by pattern
  const constraints = await sql`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'storefront_custom_category'
    AND constraint_type = 'FOREIGN KEY'`;

  for (const c of constraints) {
    console.log(`  Dropping constraint: ${c.constraint_name}`);
    await sql.unsafe(`ALTER TABLE storefront_custom_category DROP CONSTRAINT ${c.constraint_name}`);
  }
  if (constraints.length === 0) {
    console.log('  No FK constraints found.');
  }

  // ─── 3. Rename column seller_id → user_id ──────────────────────────
  console.log('[3/5] Renaming column seller_id → user_id...');
  try {
    await sql`ALTER TABLE storefront_custom_category RENAME COLUMN seller_id TO user_id`;
    console.log('  Renamed.');
  } catch (e: any) {
    if (e.message?.includes('column "seller_id" does not exist')) {
      console.log('  Column already renamed (seller_id not found).');
    } else if (e.message?.includes('column "user_id" already exists')) {
      console.log('  Column user_id already exists.');
    } else {
      throw e;
    }
  }

  // ─── 4. Add new FK constraint → user(id) ───────────────────────────
  console.log('[4/5] Adding new FK constraint → user(id)...');
  try {
    await sql`
      ALTER TABLE storefront_custom_category
      ADD CONSTRAINT scc_user_fk
      FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE`;
    console.log('  Added FK scc_user_fk → user(id).');
  } catch (e: any) {
    if (e.code === '42710') {
      console.log('  Constraint already exists.');
    } else {
      throw e;
    }
  }

  // ─── 5. Create new index ───────────────────────────────────────────
  console.log('[5/5] Creating new index scc_user...');
  try {
    await sql`CREATE INDEX scc_user ON storefront_custom_category(user_id)`;
    console.log('  Created index scc_user.');
  } catch (e: any) {
    if (e.code === '42P07') {
      console.log('  Index already exists.');
    } else {
      throw e;
    }
  }

  // ─── VERIFY ────────────────────────────────────────────────────────
  console.log('\n=== VERIFICATION ===');

  const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'storefront_custom_category'
    ORDER BY ordinal_position`;
  console.log('Columns:', cols.map(c => c.column_name).join(', '));

  const fks = await sql`
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'storefront_custom_category'
    AND tc.constraint_type = 'FOREIGN KEY'`;
  console.log('FK constraints:', fks);

  const indexes = await sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'storefront_custom_category'`;
  console.log('Indexes:', indexes.map(i => i.indexname).join(', '));

  console.log('\nD1a HOTFIX complete.');
  await sql.end();
}

main().catch(async e => {
  console.error('FAILED:', e);
  await sql.end();
  process.exit(1);
});
