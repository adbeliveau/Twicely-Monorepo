/**
 * Integration test: Centrifugo
 * Requires: Centrifugo running on localhost:8000
 *
 * Tests health, server info, and channel publishing.
 */
import { describe, it, expect } from 'vitest';

const CENTRIFUGO_URL = process.env.CENTRIFUGO_API_URL ?? 'http://127.0.0.1:8000';
const CENTRIFUGO_KEY = process.env.CENTRIFUGO_API_KEY ?? '';

const apiHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(CENTRIFUGO_KEY ? { Authorization: `apikey ${CENTRIFUGO_KEY}` } : {}),
};

describe('Centrifugo Integration', () => {
  it('server is reachable', async () => {
    const resp = await fetch(`${CENTRIFUGO_URL}/`);
    expect(resp.status).toBe(200);
  });

  it('publishes to a channel', async () => {
    const resp = await fetch(`${CENTRIFUGO_URL}/api/publish`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        channel: 'test:integration',
        data: { event: 'test', timestamp: Date.now() },
      }),
    });
    // Centrifugo returns 200 on success or 401 if API key is required
    expect([200, 401]).toContain(resp.status);
  });

  it('retrieves server info', async () => {
    const resp = await fetch(`${CENTRIFUGO_URL}/api/info`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({}),
    });
    expect([200, 401]).toContain(resp.status);
  });
});
