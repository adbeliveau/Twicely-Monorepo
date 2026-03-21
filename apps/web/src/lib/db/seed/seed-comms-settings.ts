import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { platformSetting } from '../schema';

const COMMS_SETTINGS = [
  {
    key: 'comms.email.enabled',
    value: true,
    type: 'boolean' as const,
    category: 'comms',
    description: 'Master switch for outbound email',
  },
  {
    key: 'comms.email.maxPerDayPerUser',
    value: 50,
    type: 'number' as const,
    category: 'comms',
    description: 'Maximum emails sent per user per day',
  },
  {
    key: 'comms.email.marketingEnabled',
    value: true,
    type: 'boolean' as const,
    category: 'comms',
    description: 'Platform-level marketing email switch',
  },
  {
    key: 'comms.email.marketingOptInRequired',
    value: true,
    type: 'boolean' as const,
    category: 'comms',
    description: 'Require explicit opt-in for marketing emails',
  },
  {
    key: 'comms.push.enabled',
    value: true,
    type: 'boolean' as const,
    category: 'comms',
    description: 'Master switch for push notifications',
  },
  {
    key: 'comms.push.maxPerDayPerUser',
    value: 20,
    type: 'number' as const,
    category: 'comms',
    description: 'Maximum push notifications per user per day',
  },
  {
    key: 'comms.sms.enabled',
    value: false,
    type: 'boolean' as const,
    category: 'comms',
    description: 'Master switch for SMS (disabled by default)',
  },
  {
    key: 'comms.sms.maxPerDayPerUser',
    value: 5,
    type: 'number' as const,
    category: 'comms',
    description: 'Maximum SMS messages per user per day',
  },
  {
    key: 'comms.digest.enabled',
    value: true,
    type: 'boolean' as const,
    category: 'comms',
    description: 'Enable digest email aggregation',
  },
  {
    key: 'comms.digest.frequency',
    value: 'daily',
    type: 'string' as const,
    category: 'comms',
    description: 'Default digest frequency: daily | weekly',
  },
  {
    key: 'comms.digest.timeUtc',
    value: '14:00',
    type: 'string' as const,
    category: 'comms',
    description: 'Default digest send time in UTC (HH:MM)',
  },
];

/**
 * Seed comms platform settings from Platform Settings Canonical Section 12.
 */
export async function seedCommsSettings(db: PostgresJsDatabase): Promise<void> {
  for (const setting of COMMS_SETTINGS) {
    await db
      .insert(platformSetting)
      .values({
        key: setting.key,
        value: setting.value,
        type: setting.type,
        category: setting.category,
        description: setting.description,
      })
      .onConflictDoNothing();
  }
}
