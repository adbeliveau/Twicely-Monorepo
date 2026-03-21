import { TWICELY_API_BASE, EXTENSION_VERSION } from './constants';
import type { RegistrationResponse, HeartbeatResponse, ScrapedListing } from './types';

function makeHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Twicely-Extension-Version': EXTENSION_VERSION,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const apiClient = {
  async register(registrationToken: string): Promise<RegistrationResponse> {
    const response = await fetch(`${TWICELY_API_BASE}/api/extension/register`, {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        registrationToken,
        extensionVersion: EXTENSION_VERSION,
      }),
    });
    return response.json() as Promise<RegistrationResponse>;
  },

  async heartbeat(token: string): Promise<HeartbeatResponse> {
    const response = await fetch(`${TWICELY_API_BASE}/api/extension/heartbeat`, {
      method: 'POST',
      headers: makeHeaders(token),
    });
    return response.json() as Promise<HeartbeatResponse>;
  },

  async reportSession(
    token: string,
    channel: string,
    sessionData: Record<string, unknown>,
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${TWICELY_API_BASE}/api/extension/session`, {
      method: 'POST',
      headers: makeHeaders(token),
      body: JSON.stringify({ channel, sessionData }),
    });
    return response.json() as Promise<{ success: boolean }>;
  },

  async reportPlatformDetected(token: string, channel: string, url: string): Promise<void> {
    // Fire-and-forget
    fetch(`${TWICELY_API_BASE}/api/extension/detect`, {
      method: 'POST',
      headers: makeHeaders(token),
      body: JSON.stringify({ channel, url }),
    }).catch(() => {
      // Intentionally ignored — fire-and-forget
    });
  },

  async reportListingScrape(
    token: string,
    channel: string,
    listing: ScrapedListing,
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${TWICELY_API_BASE}/api/extension/scrape`, {
      method: 'POST',
      headers: makeHeaders(token),
      body: JSON.stringify({ channel, listing }),
    });
    return response.json() as Promise<{ success: boolean }>;
  },
};
