/** Channels the extension supports */
export type ExtensionChannel = 'POSHMARK' | 'FB_MARKETPLACE' | 'THEREALREAL' | 'VESTIAIRE';

/** Auth state stored in chrome.storage.local */
export interface ExtensionAuthState {
  token: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  expiresAt: number; // Unix timestamp ms
  registeredAt: number; // Unix timestamp ms
}

/** Full listing shape scraped from a platform page */
export interface ScrapedListing {
  externalId: string;
  title: string;
  priceCents: number;
  currency?: string;  // ISO 4217 code. Default 'USD' if omitted.
  description: string;
  condition: string | null;
  brand: string | null;
  category: string | null;
  size: string | null;
  imageUrls: string[];
  url: string;
}

/** Session data captured from Poshmark in the browser */
export interface PoshmarkBrowserSession {
  jwt: string;
  username: string;
  userId: string;
}

/** Session data captured from Facebook Marketplace in the browser */
export interface FbMarketplaceBrowserSession {
  accessToken: string;
  userId: string;
  userName: string | null;
}

/** Session data captured from TheRealReal in the browser */
export interface TheRealRealBrowserSession {
  sessionId: string;
  csrfToken: string;
  userId: string;
  email: string;
}

/** Session data captured from Vestiaire Collective in the browser */
export interface VestiaireBrowserSession {
  sessionToken: string;
  userId: string;
  email: string;
}

/** Actions that the service worker can instruct content scripts to perform */
export type ContentScriptAction =
  | 'SCRAPE_LISTING'         // Read current page listing data
  | 'CAPTURE_SESSION'        // Extract session tokens from the page
  | 'AUTOFILL_LISTING';      // Fill the "create listing" form with Twicely data

/** Payload for AUTOFILL_LISTING action */
export interface AutofillPayload {
  title: string;
  description: string;
  priceCents: number;
  condition: string | null;
  brand: string | null;
  category: string | null;
  size: string | null;
  imageUrls: string[];
}

/** Extension registration response from server */
export interface RegistrationResponse {
  success: boolean;
  token?: string;
  userId?: string;
  displayName?: string;
  avatarUrl?: string | null;
  expiresAt?: number;
  error?: string;
}

/** Heartbeat response */
export interface HeartbeatResponse {
  success: boolean;
  serverTime: number;
  connectedChannels: string[];
}

/** Messages FROM content scripts TO service worker */
export type ContentToBackground =
  | { type: 'PLATFORM_DETECTED'; channel: ExtensionChannel; url: string }
  | { type: 'SESSION_CAPTURED'; channel: ExtensionChannel; sessionData: Record<string, unknown> }
  | { type: 'LISTING_SCRAPED'; channel: ExtensionChannel; listing: ScrapedListing }
  | { type: 'ACTION_RESULT'; channel: ExtensionChannel; action: string; success: boolean; error?: string }
  | { type: 'GET_AUTH_STATE' };

/** Messages FROM service worker TO content scripts (responses) */
export type BackgroundToContent =
  | { type: 'AUTH_STATE'; authenticated: boolean; userId: string | null }
  | { type: 'EXECUTE_ACTION'; action: ContentScriptAction; payload: Record<string, unknown> }
  | { type: 'ACK'; success: boolean };
