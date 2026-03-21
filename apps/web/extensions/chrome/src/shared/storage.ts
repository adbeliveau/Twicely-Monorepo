import type { ExtensionAuthState } from './types';

const AUTH_STATE_KEY = 'twicely_auth_state';

export async function getAuthState(): Promise<ExtensionAuthState | null> {
  const result = await chrome.storage.local.get(AUTH_STATE_KEY);
  const value = result[AUTH_STATE_KEY] as ExtensionAuthState | undefined;
  return value ?? null;
}

export async function setAuthState(state: ExtensionAuthState): Promise<void> {
  await chrome.storage.local.set({ [AUTH_STATE_KEY]: state });
}

export async function clearAuthState(): Promise<void> {
  await chrome.storage.local.remove(AUTH_STATE_KEY);
}

export async function getStoredToken(): Promise<string | null> {
  const state = await getAuthState();
  return state?.token ?? null;
}
