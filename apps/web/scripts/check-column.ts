import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const result = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'listing_offer' AND column_name = 'shipping_address_id'`);
  console.log('Result:', JSON.stringify(result));

  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];

  if (rows.length === 0) {
    console.log('Column missing. Adding shipping_address_id...');
    await db.execute(sql`ALTER TABLE listing_offer ADD COLUMN IF NOT EXISTS shipping_address_id TEXT`);
    console.log('Column added.');
  } else {
    console.log('Column already exists.');
  }

  process.exit(0);
}

main();
