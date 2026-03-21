/**
 * Poshmark content script module (H1.2)
 *
 * Handles session capture, listing scrape, and form auto-fill for Poshmark.
 * This module is NOT an IIFE — it exports a handler object consumed by bridge.ts.
 *
 * All platform data flows through chrome.runtime.sendMessage to the service worker.
 * No direct HTTP calls are made from this module.
 *
 * Canonical refs:
 *   - Lister Canonical §9.1 (Tier C, session-based)
 *   - Lister Canonical §9.4 (session automation safeguards)
 *   - Lister Canonical §16 (Poshmark automation modes)
 */

import type { ScrapedListing, AutofillPayload } from '../shared/types';
import {
  parsePriceStringToCents,
  setReactInputValue,
  randomDelay,
  extractJwtFromCookies,
  parseNextData,
  safeGet,
} from './shared-utils';

// ── Session Capture ───────────────────────────────────────────────────────────

/**
 * Attempt to capture the Poshmark session from the current page.
 *
 * Strategy:
 * 1. Parse __NEXT_DATA__ for user info and auth tokens
 * 2. Fall back to cookies for a JWT-shaped value
 * 3. If user is not logged in, return null (no message sent)
 *
 * The returned object shape matches PoshmarkSessionData in poshmark-connector.ts:
 *   { jwt: string; username: string; [key: string]: unknown }
 */
export async function captureSession(): Promise<Record<string, unknown> | null> {
  // Strategy 1: parse __NEXT_DATA__ for structured user data
  const nextData = parseNextData();
  if (nextData) {
    // Try common paths where Poshmark stores user info
    const userFromProps = safeGet(nextData, 'props.pageProps.user');
    const userFromGlobals = safeGet(nextData, 'props.pageProps.globals.me');
    const user = userFromProps ?? userFromGlobals;

    if (user && typeof user === 'object') {
      const u = user as Record<string, unknown>;
      const username = typeof u['username'] === 'string' ? u['username'] : null;
      const userId = typeof u['id'] === 'string' ? u['id'] : null;

      if (username) {
        // Look for JWT in cookies using the known JWT prefix
        const jwtFromCookie = extractJwtFromCookies(document.cookie);
        // Also check localStorage for _posh_auth token
        let jwtFromStorage: string | null = null;
        try {
          const stored = window.localStorage.getItem('__posh_auth');
          if (stored && stored.startsWith('eyJ')) {
            jwtFromStorage = stored;
          }
        } catch {
          // localStorage may be unavailable — safe to ignore
        }

        const jwt = jwtFromCookie ?? jwtFromStorage ?? '';
        if (jwt) {
          return {
            jwt,
            username,
            userId: userId ?? '',
          };
        }
      }
    }
  }

  // Strategy 2: cookie-only fallback (user is logged in but __NEXT_DATA__ not helpful)
  const jwt = extractJwtFromCookies(document.cookie);
  if (!jwt) {
    // No JWT-shaped cookie — user is likely not logged in
    return null;
  }

  // Try to get username from DOM selector as last resort
  const usernameEl =
    document.querySelector<HTMLElement>('.header__username') ??
    document.querySelector<HTMLElement>('[data-username]');
  const username = usernameEl?.textContent?.trim() ?? usernameEl?.getAttribute('data-username') ?? null;

  if (!username) {
    // Cannot identify user — do not report
    return null;
  }

  return { jwt, username, userId: '' };
}

// ── Listing Scrape ────────────────────────────────────────────────────────────

/**
 * Scrape the current Poshmark listing detail page.
 * Only call this on URLs matching /listing/<id>.
 *
 * Strategy:
 * 1. Parse __NEXT_DATA__ for structured listing data (most reliable)
 * 2. Fall back to DOM selectors if __NEXT_DATA__ is unavailable
 *
 * Returns null if the listing cannot be extracted.
 */
export function scrapeListing(): ScrapedListing | null {
  // Extract external ID from URL: /listing/<id>
  const match = window.location.pathname.match(/^\/listing\/([^/?#]+)/);
  const externalId = match?.[1] ?? null;
  if (!externalId) return null;

  // Strategy 1: __NEXT_DATA__
  const nextData = parseNextData();
  if (nextData) {
    // Common paths Poshmark uses for listing data
    const listingPaths = [
      'props.pageProps.listing',
      'props.pageProps.listingData.listing',
      'props.pageProps.data.listing',
    ];

    for (const path of listingPaths) {
      const listing = safeGet(nextData, path);
      if (listing && typeof listing === 'object') {
        const l = listing as Record<string, unknown>;
        const title = typeof l['title'] === 'string' ? l['title'] : null;
        const priceCents = extractPriceCentsFromNextData(l);

        if (title && priceCents !== null) {
          return {
            externalId,
            title: title.trim(),
            priceCents,
            description: typeof l['description'] === 'string' ? l['description'] : '',
            condition: extractConditionFromNextData(l),
            brand: typeof l['brand'] === 'string' ? l['brand'] : null,
            category: extractCategoryFromNextData(l),
            size: extractSizeFromNextData(l),
            imageUrls: extractImageUrlsFromNextData(l),
            url: window.location.href,
          };
        }
      }
    }
  }

  // Strategy 2: DOM selectors fallback
  return scrapeListingFromDom(externalId);
}

function extractPriceCentsFromNextData(l: Record<string, unknown>): number | null {
  // Poshmark may store price as number (in dollars or cents) or string
  const price = l['price_amount'] ?? l['price'] ?? l['originalPrice'];
  if (typeof price === 'number') {
    // If > 10000, assume already in cents; otherwise assume dollars
    return price > 10000 ? price : Math.round(price * 100);
  }
  if (typeof price === 'string') {
    return parsePriceStringToCents(price);
  }
  return null;
}

function extractConditionFromNextData(l: Record<string, unknown>): string | null {
  const cond = l['condition'] ?? l['inventory_status'];
  return typeof cond === 'string' ? cond : null;
}

function extractCategoryFromNextData(l: Record<string, unknown>): string | null {
  const cat = l['category_v2'] ?? l['category'];
  if (cat && typeof cat === 'object') {
    const c = cat as Record<string, unknown>;
    return typeof c['display'] === 'string' ? c['display'] : null;
  }
  return typeof cat === 'string' ? cat : null;
}

function extractSizeFromNextData(l: Record<string, unknown>): string | null {
  const size = l['size'] ?? l['size_system'];
  return typeof size === 'string' ? size : null;
}

function extractImageUrlsFromNextData(l: Record<string, unknown>): string[] {
  const pictures = l['pictures'];
  if (!Array.isArray(pictures)) return [];
  return pictures
    .map((p: unknown) => {
      if (p && typeof p === 'object') {
        const pic = p as Record<string, unknown>;
        return (
          (typeof pic['url_fullsize'] === 'string' ? pic['url_fullsize'] : null) ??
          (typeof pic['url'] === 'string' ? pic['url'] : null)
        );
      }
      return null;
    })
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
}

function scrapeListingFromDom(externalId: string): ScrapedListing | null {
  const titleEl =
    document.querySelector<HTMLElement>('.listing__title') ??
    document.querySelector<HTMLElement>('[data-test="listing-title"]') ??
    document.querySelector<HTMLElement>('h1');
  const title = titleEl?.textContent?.trim() ?? null;
  if (!title) return null;

  const priceEl =
    document.querySelector<HTMLElement>('.listing__price') ??
    document.querySelector<HTMLElement>('[data-test="listing-price"]');
  const priceRaw = priceEl?.textContent?.trim() ?? null;
  const priceCents = priceRaw ? parsePriceStringToCents(priceRaw) : null;
  if (priceCents === null) return null;

  const descEl =
    document.querySelector<HTMLElement>('.listing__description') ??
    document.querySelector<HTMLElement>('[data-test="listing-description"]');
  const description = descEl?.textContent?.trim() ?? '';

  const condBadge = document.querySelector<HTMLElement>('[data-test="listing-condition"]');
  const condition = condBadge?.textContent?.trim() ?? null;

  const brandEl =
    document.querySelector<HTMLAnchorElement>('.listing__brand a') ??
    document.querySelector<HTMLElement>('[data-test="listing-brand"]');
  const brand = brandEl?.textContent?.trim() ?? null;

  const sizeEl =
    document.querySelector<HTMLElement>('.listing__size') ??
    document.querySelector<HTMLElement>('[data-test="listing-size"]');
  const size = sizeEl?.textContent?.trim() ?? null;

  // Category from breadcrumb
  const breadcrumbs = Array.from(document.querySelectorAll<HTMLElement>('[data-test="breadcrumb"] a'));
  const category = breadcrumbs.length > 0
    ? breadcrumbs.map((el) => el.textContent?.trim()).filter(Boolean).join(' > ')
    : null;

  // Images: look for gallery carousel images; prefer full-size URLs
  const imgEls = Array.from(
    document.querySelectorAll<HTMLImageElement>(
      '.gallery img, [data-test="listing-image"] img, .img__container img',
    ),
  );
  const imageUrls = imgEls
    .map((img) => {
      // Check srcset for highest resolution
      const srcset = img.srcset;
      if (srcset) {
        const parts = srcset.split(',').map((s) => s.trim().split(' ')[0]).filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1];
      }
      return img.src || null;
    })
    .filter((url): url is string => typeof url === 'string' && url.startsWith('http'));

  return {
    externalId,
    title,
    priceCents,
    description,
    condition,
    brand,
    category,
    size,
    imageUrls,
    url: window.location.href,
  };
}

// ── Auto-fill ─────────────────────────────────────────────────────────────────

/**
 * Fill the Poshmark listing creation form with data from the payload.
 *
 * Poshmark uses React controlled components — plain value assignment is
 * ignored. setReactInputValue() uses the native setter trick + event dispatch.
 *
 * Photo upload is NOT automated (browser security restriction).
 * Returns true if all required fields were filled successfully.
 */
export async function autofillListing(payload: AutofillPayload): Promise<boolean> {
  let allFilled = true;

  // Title
  const titleInput = document.querySelector<HTMLInputElement>(
    'input[name="title"], input[placeholder*="Title"], input[data-test="title-input"]',
  );
  if (titleInput) {
    setReactInputValue(titleInput, payload.title);
    await randomDelay(300, 800);
  } else {
    allFilled = false;
  }

  // Description
  const descInput = document.querySelector<HTMLTextAreaElement>(
    'textarea[name="description"], textarea[placeholder*="Description"], textarea[data-test="description-input"]',
  );
  if (descInput) {
    setReactInputValue(descInput, payload.description);
    await randomDelay(300, 800);
  } else {
    allFilled = false;
  }

  // Price: convert cents to dollar string
  const priceInput = document.querySelector<HTMLInputElement>(
    'input[name="price"], input[placeholder*="Price"], input[data-test="price-input"]',
  );
  if (priceInput) {
    const dollars = (payload.priceCents / 100).toFixed(2);
    setReactInputValue(priceInput, dollars);
    await randomDelay(300, 800);
  } else {
    allFilled = false;
  }

  // Brand (optional — do not fail if absent)
  if (payload.brand) {
    const brandInput = document.querySelector<HTMLInputElement>(
      'input[name="brand"], input[placeholder*="Brand"], input[data-test="brand-input"]',
    );
    if (brandInput) {
      setReactInputValue(brandInput, payload.brand);
      await randomDelay(300, 800);
    }
  }

  // Size (optional — click matching size button if present)
  if (payload.size) {
    const sizeButtons = Array.from(
      document.querySelectorAll<HTMLElement>('[data-test="size-option"], .size-selector__option'),
    );
    const matchingSize = sizeButtons.find(
      (btn) => btn.textContent?.trim().toLowerCase() === payload.size?.toLowerCase(),
    );
    if (matchingSize) {
      matchingSize.click();
      await randomDelay(200, 500);
    }
  }

  // Condition (optional — click matching condition radio/button)
  if (payload.condition) {
    const condButtons = Array.from(
      document.querySelectorAll<HTMLElement>('[data-test="condition-option"], .condition-selector__option'),
    );
    const matchingCond = condButtons.find(
      (btn) => btn.textContent?.trim().toLowerCase() === payload.condition?.toLowerCase(),
    );
    if (matchingCond) {
      matchingCond.click();
      await randomDelay(200, 500);
    }
  }

  return allFilled;
}

/** Handler object exported for bridge.ts dispatcher */
export const poshmarkHandler = {
  captureSession,
  scrapeListing,
  autofillListing: async (payload: AutofillPayload) => autofillListing(payload),
};
