/**
 * One-time script: Create adrian@twicely.co as SUPER_ADMIN staff user.
 *
 * Usage:
 *   npx tsx src/lib/db/seed/seed-adrian-admin.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { hash } from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { staffUser, staffUserRole } from '../schema';
import { createId } from '@paralleldrive/cuid2';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL!);
  const db = drizzle(sql);

  const staffId = createId();
  const roleId = createId();
  const seedPassword = process.env.SEED_ADRIAN_PASSWORD;
  if (!seedPassword) {
    throw new Error('SEED_ADRIAN_PASSWORD env var is required — set it before running seed');
  }
  const passwordHash = await hash(seedPassword, 10);

  await db.insert(staffUser).values({
    id: staffId,
    email: 'adrian@twicely.co',
    displayName: 'Adrian',
    passwordHash,
    mfaEnabled: false,
    isActive: true,
  }).onConflictDoNothing();

  // If user already exists, get their ID
  const [existing] = await sql`
    SELECT id FROM staff_user WHERE email = 'adrian@twicely.co' LIMIT 1
  `;
  const userId = existing?.id ?? staffId;

  await db.insert(staffUserRole).values({
    id: roleId,
    staffUserId: userId as string,
    role: 'SUPER_ADMIN',
    grantedByStaffId: userId as string,
  }).onConflictDoNothing();

  console.log(`✅ adrian@twicely.co created as SUPER_ADMIN (id: ${userId})`);

  await sql.end();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
