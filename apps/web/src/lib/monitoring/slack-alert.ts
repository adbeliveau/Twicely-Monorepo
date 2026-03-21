/**
 * Slack webhook alert sender for health check failures.
 */

import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { DoctorSummary } from './types';

export async function sendSlackAlert(summary: DoctorSummary): Promise<void> {
  if (summary.overall === 'HEALTHY') return;

  const webhookUrl = await getPlatformSetting<string>(
    'monitoring.alertSlackWebhook', ''
  );
  if (!webhookUrl) return;

  const failed = summary.checks.filter((c) => c.status !== 'HEALTHY');
  const text = [
    `*Health Check Alert: ${summary.overall}*`,
    ...failed.map((c) => `- ${c.module}/${c.name}: ${c.status} — ${c.message ?? 'N/A'}`),
  ].join('\n');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    logger.error('Failed to send Slack alert', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}
