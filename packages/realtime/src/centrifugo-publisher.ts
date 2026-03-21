/**
 * Centrifugo server-side publish helper.
 * Publishes events to channels using the Centrifugo HTTP API.
 * Source: Lister Canonical §21; F5-S1 install prompt §1.1, §1.6
 *
 * Environment: CENTRIFUGO_API_URL, CENTRIFUGO_API_KEY
 *
 * NOT a 'use server' file. Plain TypeScript module.
 * Fire-and-forget: errors are logged but not thrown.
 */

import { logger } from '@twicely/logger';
import { getInfraConfig } from '@twicely/config/infra-config';

interface CentrifugoPublishPayload {
  channel: string;
  data: Record<string, unknown>;
}

/**
 * Publish an event to a Centrifugo channel.
 * Silently skips if centrifugoApiUrl is not configured.
 */
export async function publishToChannel(
  channel: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { centrifugoApiUrl: apiUrl, centrifugoApiKey: apiKey } = getInfraConfig();

  if (!apiUrl) {
    logger.warn('[centrifugoPublisher] centrifugoApiUrl not configured — skipping publish', { channel });
    return;
  }

  const body: CentrifugoPublishPayload = { channel, data };

  try {
    const response = await fetch(`${apiUrl}/api/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `apikey ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('[centrifugoPublisher] Publish failed', { channel, status: response.status, body: text });
    }
  } catch (err) {
    logger.error('[centrifugoPublisher] Network error publishing to channel', {
      channel,
      error: String(err),
    });
  }
}

/**
 * Build the private user channel name for a seller.
 * Format: private-user.{sellerId}
 * Source: Lister Canonical §21
 */
export function sellerChannel(sellerId: string): string {
  return `private-user.${sellerId}`;
}
