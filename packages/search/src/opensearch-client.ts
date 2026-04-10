/**
 * OpenSearch client singleton — self-hosted Docker (dev + prod).
 * Reads OPENSEARCH_URL, OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD from env.
 */

import { Client } from '@opensearch-project/opensearch';

let client: Client | null = null;

/** Get or create the OpenSearch client singleton. */
export function getOpenSearchClient(): Client {
  if (client) return client;

  const node = process.env.OPENSEARCH_URL ?? 'http://127.0.0.1:9200';
  const username = process.env.OPENSEARCH_USERNAME ?? '';
  const password = process.env.OPENSEARCH_PASSWORD ?? '';

  const opts: ConstructorParameters<typeof Client>[0] = {
    node,
    ssl: { rejectUnauthorized: node.startsWith('https') },
    requestTimeout: 5000,
    maxRetries: 3,
  };

  if (username && password) {
    opts.auth = { username, password };
  }

  client = new Client(opts);
  return client;
}

/** Reset the singleton (used in tests). */
export function resetOpenSearchClient(): void {
  client = null;
}
