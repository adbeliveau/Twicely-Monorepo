import { getStoredToken, getAuthState, setAuthState, clearAuthState } from '../shared/storage';
import { apiClient } from '../shared/api-client';
import { HEARTBEAT_INTERVAL_MINUTES, TWICELY_API_BASE } from '../shared/constants';
import type { ContentToBackground, BackgroundToContent, ExtensionAuthState } from '../shared/types';

// ── Install handler ───────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'https://twicely.co/my/selling/crosslist?source=extension' });
  }
});

// ── Heartbeat alarm ───────────────────────────────────────────────────────────

chrome.alarms.create('twicely-heartbeat', { periodInMinutes: HEARTBEAT_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'twicely-heartbeat') {
    const token = await getStoredToken();
    if (token) {
      await apiClient.heartbeat(token);
    }
  }
});

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ContentToBackground, _sender, sendResponse: (response: BackgroundToContent) => void) => {
    handleMessage(message, sendResponse);
    // Return true to keep the message channel open for async responses
    return true;
  },
);

async function handleMessage(
  message: ContentToBackground,
  sendResponse: (response: BackgroundToContent) => void,
): Promise<void> {
  if (message.type === 'GET_AUTH_STATE') {
    const state = await getAuthState();
    sendResponse({
      type: 'AUTH_STATE',
      authenticated: state !== null,
      userId: state?.userId ?? null,
    });
    return;
  }

  if (message.type === 'PLATFORM_DETECTED') {
    const token = await getStoredToken();
    if (token) {
      await apiClient.reportPlatformDetected(token, message.channel, message.url);
    }
    sendResponse({ type: 'ACK', success: true });
    return;
  }

  if (message.type === 'SESSION_CAPTURED') {
    const token = await getStoredToken();
    if (token) {
      await apiClient.reportSession(token, message.channel, message.sessionData);
    }
    sendResponse({ type: 'ACK', success: true });
    return;
  }

  if (message.type === 'LISTING_SCRAPED') {
    // Store for popup UI to display (H1.4 will add the popup display)
    await chrome.storage.local.set({
      lastScrapedListing: {
        channel: message.channel,
        listing: message.listing,
        scrapedAt: Date.now(),
      },
    });
    const token = await getStoredToken();
    if (token) {
      await apiClient.reportListingScrape(token, message.channel, message.listing);
    }
    sendResponse({ type: 'ACK', success: true });
    return;
  }

  if (message.type === 'ACTION_RESULT') {
    // Log action results -- H1.4 will show these in popup
    // For now, just acknowledge
    sendResponse({ type: 'ACK', success: true });
    return;
  }

  sendResponse({ type: 'ACK', success: false });
}

// ── Token polling from localStorage (callback page) ──────────────────────────
// The callback page stores the registration token in localStorage.
// The popup polls for it and calls this function.

export async function exchangeRegistrationToken(registrationToken: string): Promise<ExtensionAuthState | null> {
  const response = await apiClient.register(registrationToken);
  if (
    !response.success ||
    !response.token ||
    !response.userId ||
    !response.displayName ||
    response.expiresAt === undefined
  ) {
    return null;
  }

  const state: ExtensionAuthState = {
    token: response.token,
    userId: response.userId,
    displayName: response.displayName,
    avatarUrl: response.avatarUrl ?? null,
    expiresAt: response.expiresAt,
    registeredAt: Date.now(),
  };

  await setAuthState(state);
  return state;
}

export { getAuthState, clearAuthState };

// Make these available globally for the popup (loaded in same extension context)
(globalThis as Record<string, unknown>)['__twicelyExchangeToken'] = exchangeRegistrationToken;
(globalThis as Record<string, unknown>)['__twicelyApiBase'] = TWICELY_API_BASE;
