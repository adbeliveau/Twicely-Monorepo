/**
 * Admin Search Engine Query (I11)
 * Fetches Typesense collection information for the Search Admin page.
 * Gracefully degrades if Typesense is not configured or unreachable.
 */

import { getInfraConfig } from '@/lib/config/infra-config';

export interface TypesenseCollectionInfo {
  name: string;
  numDocuments: number;
}

export interface TypesenseStatus {
  connected: boolean;
  latencyMs: number | null;
  collections: TypesenseCollectionInfo[];
  error?: string;
}

/**
 * Fetch Typesense collection list with connection status.
 * Uses server-side fetch to the Typesense admin API.
 * Returns { connected: false } gracefully if not configured or unreachable.
 */
export async function getTypesenseCollections(): Promise<TypesenseStatus> {
  const { typesenseUrl, typesenseApiKey } = getInfraConfig();

  if (!typesenseUrl || !typesenseApiKey) {
    return {
      connected: false,
      latencyMs: null,
      collections: [],
      error: 'Typesense not configured',
    };
  }

  const start = Date.now();

  try {
    const response = await fetch(`${typesenseUrl}/collections`, {
      method: 'GET',
      headers: {
        'X-TYPESENSE-API-KEY': typesenseApiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return {
        connected: false,
        latencyMs,
        collections: [],
        error: `Typesense returned ${response.status}`,
      };
    }

    const data = (await response.json()) as Array<{
      name: string;
      num_documents: number;
    }>;

    const collections: TypesenseCollectionInfo[] = data.map((c) => ({
      name: c.name,
      numDocuments: c.num_documents,
    }));

    return {
      connected: true,
      latencyMs,
      collections,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      latencyMs,
      collections: [],
      error: message,
    };
  }
}
