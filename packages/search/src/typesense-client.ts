/**
 * Typesense client — singleton initialized from infrastructure config.
 * Falls back to env vars if platform_settings not loaded.
 */

import { Client } from 'typesense';

let client: Client | null = null;

export function getTypesenseClient(): Client {
  if (client) return client;

  const host = process.env.TYPESENSE_URL ?? 'http://127.0.0.1:8108';
  const apiKey = process.env.TYPESENSE_API_KEY ?? '';

  if (!apiKey) {
    throw new Error('TYPESENSE_API_KEY is required');
  }

  const url = new URL(host);

  client = new Client({
    nodes: [{
      host: url.hostname,
      port: Number(url.port) || 8108,
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
    }],
    apiKey,
    connectionTimeoutSeconds: 5,
    retryIntervalSeconds: 0.1,
    numRetries: 3,
  });

  return client;
}

export function resetTypesenseClient(): void {
  client = null;
}
