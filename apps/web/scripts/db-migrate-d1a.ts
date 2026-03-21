import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  console.log('=== D1a Migration: Storefront Schema ===\n');

  // ─── 1. Add storefront columns to seller_profile ─────────────────
  console.log('[1/2] Adding storefront columns to seller_profile...');

  const columns = [
    { name: 'banner_url', type: 'TEXT' },
    { name: 'logo_url', type: 'TEXT' },
    { name: 'accent_color', type: 'TEXT' },
    { name: 'announcement', type: 'TEXT' },
    { name: 'about_html', type: 'TEXT' },
    { name: 'social_links', type: "JSONB NOT NULL DEFAULT '{}'" },
    { name: 'featured_listing_ids', type: "TEXT[] NOT NULL DEFAULT '{}'" },
    { name: 'is_store_published', type: 'BOOLEAN NOT NULL DEFAULT false' },
    { name: 'default_store_view', type: "TEXT NOT NULL DEFAULT 'grid'" },
  ];

  for (const col of columns) {
    try {
      await sql.unsafe(`ALTER TABLE seller_profile ADD COLUMN ${col.name} ${col.type}`);
      console.log(`  Added ${col.name}`);
    } catch (e: any) {
      if (e.code === '42701') {
        console.log(`  ${col.name}: already exists`);
      } else {
        throw e;
      }
    }
  }

  // ─── 2. Create storefront_custom_category table ──────────────────
  console.log('\n[2/2] Creating storefront_custom_category table...');

  try {
    await sql`
      CREATE TABLE storefront_custom_category (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL REFERENCES seller_profile(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        listing_ids TEXT[] NOT NULL DEFAULT '{}'
      )`;
    console.log('  Created table.');

    await sql`CREATE INDEX scc_seller ON storefront_custom_category(seller_id)`;
    console.log('  Created index scc_seller.');
  } catch (e: any) {
    if (e.code === '42P07') {
      console.log('  Table already exists.');
    } else {
      throw e;
    }
  }

  // ─── VERIFY ──────────────────────────────────────────────────────
  console.log('\n=== VERIFICATION ===');

  const spCols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'seller_profile'
    AND column_name IN ('banner_url', 'logo_url', 'accent_color', 'announcement',
                        'about_html', 'social_links', 'featured_listing_ids',
                        'is_store_published', 'default_store_view')
    ORDER BY column_name`;
  console.log('seller_profile new columns:', spCols);

  const sccExists = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'storefront_custom_category'
    ) as exists`;
  console.log('storefront_custom_category exists:', sccExists[0]?.exists);

  console.log('\nD1a migration complete.');
  await sql.end();
}

main().catch(async e => {
  console.error('FAILED:', e);
  await sql.end();
  process.exit(1);
});
