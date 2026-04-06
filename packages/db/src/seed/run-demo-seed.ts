/**
 * run-demo-seed.ts — Wipes user-generated data, seeds demo data, creates Adrian superadmin.
 *
 * Usage:
 *   cd packages/db && npx tsx src/seed/run-demo-seed.ts
 *
 * Requires DATABASE_URL in apps/web/.env.local
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../../apps/web/.env.local') });

import { hash } from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { staffUser, staffUserRole } from '../schema';
import { seedDemo } from './seed-demo';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Check apps/web/.env.local');
  process.exit(1);
}

// Tables to preserve (system data)
const PRESERVED_TABLES = new Set([
  'platform_settings',
  'category',
  'category_attribute_schema',
  'fee_schedule',
  'fee_bracket',
  'staff_user',
  'staff_user_role',
  'staff_user_custom_role',
  'staff_role_permission',
  'newsletter_subscriber',
  'sequence_counter',
  'kill_switch',
  'module_registry',
  'monitoring_check',
  'monitoring_alert',
  'helpdesk_sla_policy',
  'helpdesk_email_config',
  'helpdesk_team',
  'helpdesk_team_member',
  'helpdesk_routing_rule',
  'helpdesk_macro',
  'helpdesk_automation_rule',
  'channel_policy_rule',
  'channel_category_mapping',
  'interest_tag',
  'kb_article',
  'kb_category',
  'comms_template',
  'safe_meetup_location',
]);

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(sql);

  // ── Step 1: Get all user-generated tables ──
  console.log('[run-demo-seed] Discovering tables...');
  const allTables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  const tablesToWipe = allTables
    .map((r) => r.tablename as string)
    .filter((t) => !PRESERVED_TABLES.has(t) && !t.startsWith('_') && !t.startsWith('pg_'));

  // ── Step 2: Wipe user-generated data ──
  console.log(`[run-demo-seed] Wiping ${tablesToWipe.length} tables...`);
  if (tablesToWipe.length > 0) {
    const tableList = tablesToWipe.map((t) => `"${t}"`).join(', ');
    await sql.unsafe(`TRUNCATE TABLE ${tableList} CASCADE`);
  }
  console.log('[run-demo-seed] Wipe complete.');

  // ── Step 3: Seed demo data ──
  await seedDemo(db);

  // ── Step 4: Create Adrian superadmin ──
  console.log('[run-demo-seed] Creating Adrian superadmin...');
  const adrianPassword = 'Admin12345!';
  const passwordHash = await hash(adrianPassword, 12);

  const adrianId = 'seed-demo-staff-adrian';
  const adrianRoleId = 'seed-demo-staff-role-adrian';

  await db.insert(staffUser).values({
    id: adrianId,
    email: 'adrian@twicely.co',
    displayName: 'Adrian',
    passwordHash,
    mfaEnabled: false,
    mfaRequired: false,
    isActive: true,
  }).onConflictDoNothing();

  // Get existing ID if already there
  const [existing] = await sql`
    SELECT id FROM staff_user WHERE email = 'adrian@twicely.co' LIMIT 1
  `;
  const staffId = (existing?.id as string) ?? adrianId;

  await db.insert(staffUserRole).values({
    id: adrianRoleId,
    staffUserId: staffId,
    role: 'SUPER_ADMIN',
    grantedByStaffId: staffId,
  }).onConflictDoNothing();

  console.log(`[run-demo-seed] Adrian superadmin created (email: adrian@twicely.co, pw: Admin12345!)`);

  // ── Done ──
  console.log('[run-demo-seed] All done!');
  await sql.end();
}

main().catch((err) => {
  console.error('[run-demo-seed] Failed:', err);
  process.exit(1);
});
