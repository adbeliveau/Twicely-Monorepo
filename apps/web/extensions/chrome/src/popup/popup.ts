import { getAuthState, setAuthState, clearAuthState } from '../shared/storage';
import { apiClient } from '../shared/api-client';
import { TWICELY_API_BASE, EXTENSION_VERSION } from '../shared/constants';
import type { ExtensionAuthState } from '../shared/types';

const STORED_TOKEN_KEY = 'twicely_extension_token';

// ── DOM helpers ───────────────────────────────────────────────────────────────

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} not found`);
  return element as T;
}

function showState(state: 'loading' | 'unauthenticated' | 'authenticated'): void {
  el('state-loading').classList.toggle('hidden', state !== 'loading');
  el('state-unauthenticated').classList.toggle('hidden', state !== 'unauthenticated');
  el('state-authenticated').classList.toggle('hidden', state !== 'authenticated');
}

function renderAuthenticated(authState: ExtensionAuthState): void {
  el<HTMLElement>('user-display-name').textContent = authState.displayName;
  el<HTMLElement>('ext-version').textContent = EXTENSION_VERSION;

  const avatarEl = el<HTMLImageElement>('user-avatar');
  if (authState.avatarUrl) {
    avatarEl.src = authState.avatarUrl;
    avatarEl.style.display = 'block';
  } else {
    avatarEl.style.display = 'none';
  }

  showState('authenticated');
}

// ── Platform detection ────────────────────────────────────────────────────────

async function highlightActivePlatform(): Promise<void> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.url) return;

  const url = new URL(activeTab.url);
  const hostname = url.hostname;

  const platformMap: Record<string, string> = {
    'poshmark.com': 'platform-poshmark',
    'www.poshmark.com': 'platform-poshmark',
    'www.facebook.com': 'platform-fb-marketplace',
    'www.therealreal.com': 'platform-therealreal',
  };

  const platformId = platformMap[hostname];
  if (platformId && url.pathname.startsWith('/marketplace') || platformId !== 'platform-fb-marketplace') {
    if (platformId) {
      const dotEl = el<HTMLElement>(platformId).querySelector('.dot');
      if (dotEl) {
        dotEl.classList.remove('dot-gray');
        dotEl.classList.add('dot-green');
      }
    }
  }
}

// ── Token polling from localStorage ──────────────────────────────────────────

function pollLocalStorageForToken(tabId: number): void {
  const interval = setInterval(() => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: () => {
          const token = localStorage.getItem('twicely_extension_token');
          if (token) {
            localStorage.removeItem('twicely_extension_token');
          }
          return token;
        },
      },
      async (results) => {
        const token = results?.[0]?.result as string | null | undefined;
        if (token) {
          clearInterval(interval);
          await handleRegistrationToken(token);
        }
      },
    );
  }, 500);

  // Stop polling after 5 minutes (token expiry)
  setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
}

async function handleRegistrationToken(registrationToken: string): Promise<void> {
  const response = await apiClient.register(registrationToken);
  if (
    !response.success ||
    !response.token ||
    !response.userId ||
    !response.displayName ||
    response.expiresAt === undefined
  ) {
    showState('unauthenticated');
    return;
  }

  const authState: ExtensionAuthState = {
    token: response.token,
    userId: response.userId,
    displayName: response.displayName,
    avatarUrl: response.avatarUrl ?? null,
    expiresAt: response.expiresAt,
    registeredAt: Date.now(),
  };

  await setAuthState(authState);
  renderAuthenticated(authState);
  await highlightActivePlatform();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  showState('loading');

  // Check if there's already a stored auth state
  const existing = await getAuthState();
  if (existing) {
    renderAuthenticated(existing);
    await highlightActivePlatform();
    return;
  }

  // Check localStorage for a pending registration token
  // (written by the callback page when this tab is the opener)
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.url?.startsWith(`${TWICELY_API_BASE}/api/extension/callback`)) {
    if (activeTab.id !== undefined) {
      pollLocalStorageForToken(activeTab.id);
    }
    showState('loading');
    return;
  }

  showState('unauthenticated');
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  void init();

  el('btn-connect').addEventListener('click', () => {
    chrome.tabs.create({
      url: `${TWICELY_API_BASE}/api/extension/authorize`,
    });
    // Start watching localStorage for the token after the tab opens
    setTimeout(() => {
      chrome.tabs.query({ url: `${TWICELY_API_BASE}/api/extension/callback*` }, (tabs) => {
        const tab = tabs[0];
        if (tab?.id !== undefined) {
          pollLocalStorageForToken(tab.id);
          showState('loading');
        }
      });
    }, 2000);
  });

  el('btn-disconnect').addEventListener('click', async () => {
    await clearAuthState();
    showState('unauthenticated');
  });
});

// ── Listen for postMessage from callback page (when popup is the opener) ─────

window.addEventListener('message', async (event: MessageEvent) => {
  if (event.origin !== TWICELY_API_BASE) return;
  const data = event.data as { type?: string; token?: string };
  if (data.type === 'TWICELY_EXTENSION_TOKEN' && typeof data.token === 'string') {
    await handleRegistrationToken(data.token);
  }
});

// ── Also check localStorage of the stored key left by callback page ──────────

async function checkStoredTokenKey(): Promise<void> {
  const stored = localStorage.getItem(STORED_TOKEN_KEY);
  if (stored) {
    localStorage.removeItem(STORED_TOKEN_KEY);
    await handleRegistrationToken(stored);
  }
}

void checkStoredTokenKey();
