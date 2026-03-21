import { Shippo } from 'shippo';

let shippoInstance: Shippo | null = null;

/**
 * Get Shippo client singleton instance
 * @throws Error if SHIPPO_API_KEY environment variable is not set
 */
export function getShippo(): Shippo {
  if (!shippoInstance) {
    const apiKey = process.env.SHIPPO_API_KEY;

    if (!apiKey) {
      throw new Error('SHIPPO_API_KEY not set');
    }

    shippoInstance = new Shippo({
      apiKeyHeader: apiKey,
    });
  }

  return shippoInstance;
}
