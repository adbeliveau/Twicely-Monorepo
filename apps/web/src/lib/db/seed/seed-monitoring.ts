import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';

const MONITORING_SETTINGS = [
  {
    key: 'monitoring.alertSlackWebhook',
    value: '',
    type: 'string',
    category: 'monitoring',
    description: 'Slack webhook URL for health check alert notifications',
  },
  {
    key: 'monitoring.logLevel',
    value: 'INFO',
    type: 'string',
    category: 'monitoring',
    description: 'Minimum log level in production (DEBUG, INFO, WARN, ERROR)',
  },
  {
    key: 'monitoring.metricsRetentionDays',
    value: 90,
    type: 'number',
    category: 'monitoring',
    description: 'Prometheus data retention period in days',
  },
];

export async function seedMonitoringSettings(): Promise<void> {
  for (const setting of MONITORING_SETTINGS) {
    await db
      .insert(platformSetting)
      .values(setting)
      .onConflictDoNothing({ target: platformSetting.key });
  }
}
