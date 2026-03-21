/**
 * Valkey Client Singleton
 *
 * Shared Valkey (ioredis-compatible) client for feature flag caching
 * and other key-value operations.
 *
 * Connection uses VALKEY_HOST + VALKEY_PORT (matching BullMQ queue.ts pattern).
 * Handles connection errors gracefully — callers must handle disconnected state.
 */

import Redis from 'ioredis';
import { logger } from '@twicely/logger';
import { getInfraConfig } from '@/lib/config/infra-config';

let _client: Redis | null = null;

function createClient(): Redis {
  const cfg = getInfraConfig();
  const client = new Redis({
    host: cfg.valkeyHost,
    port: cfg.valkeyPort,
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    lazyConnect: true,
  });

  client.on('error', (err: Error) => {
    logger.error('Valkey client error', { message: err.message });
  });

  client.on('connect', () => {
    logger.info('Valkey client connected');
  });

  void client.connect();

  return client;
}

/**
 * Get (or create) the shared Valkey client singleton.
 */
export function getValkeyClient(): Redis {
  if (!_client) {
    _client = createClient();
  }
  return _client;
}

/**
 * Check if the Valkey client is in a connected state.
 */
export function isConnected(): boolean {
  return _client !== null && _client.status === 'ready';
}

export type { Redis };
