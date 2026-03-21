/**
 * Vestiaire Collective content script module (H4.1)
 *
 * Handles session capture, listing scrape, and sell-form auto-fill for
 * Vestiaire Collective. This module is NOT an IIFE — it exports a handler
 * object consumed by bridge.ts.
 *
 * Vestiaire Collective is a luxury peer-to-peer resale marketplace (Tier C,
 * session-based). Key characteristics:
 *   - Multi-currency: prices may be EUR, GBP, USD, CHF, etc.
 *   - Seller-set pricing: unlike TRR, sellers control their price.
 *   - React SPA: uses JSON-LD Product schema markup on product pages.
 *
 * All platform data flows through chrome.runtime.sendMessage to the service
 * worker. No direct HTTP calls are made from this module.
 *
 * Canonical refs:
 *   - Lister Canonical §9.1 (Tier C, session-based)
 *   - Lister Canonical §9.4 (Tier C session automation safeguards)
 *   - Lister Canonical §25.2 (session isolation)
 */

import type { ScrapedListing, AutofillPayload } from '../shared/types';
import {
  parsePriceWithCurrency,
  setReactInputValue,
  randomDelay,
  getCookieValue,
} from './shared-utils';

// ── Session Capture ───────────────────────────────────────────────────────────

/**
 * Attempt to extract user info from inline <script> tags.
 * Vestiaire may embed user data as window.__INITIAL_STATE__, window.__PRELOADED_STATE__,
 * or a "user" key containing an "id" or "email" field.
 */
function extractUserFromPageScripts(): { userId: string; email: string } | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script:not([src])');
  for (const script of scripts) {
    const text = script.textContent ?? '';

    const patterns = [
      /window\.__INITIAL_STATE__\s*=\s*({.*?});/s,
      /window\.__PRELOADED_STATE__\s*=\s*({.*?});/s,
      /"currentUser"\s*:\s*({.*?})/s,
      /"user"\s*:\s*({.*?"email".*?})/s,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        try {
          const data = JSON.parse(match[1]) as Record<string, unknown>;
          const userId = String(data['id'] ?? data['user_id'] ?? data['userId'] ?? '');
          const email = String(data['email'] ?? '');
          if (userId || email) {
            return { userId, email };
          }
        } catch {
          // Parse failed, try next pattern
        }
      }
    }
  }
  return null;
}

/**
 * Fall back to extracting user info from DOM elements (account link,
 * profile dropdown, data attributes).
 */
function extractUserFromDom(): { userId: string; email: string } | null {
  // Check for logged-in indicator (account link, user avatar, profile dropdown)
  const accountLink =
    document.querySelector<HTMLAnchorElement>('a[href*="/member/"]') ??
    document.querySelector<HTMLAnchorElement>('a[href*="/account"]') ??
    document.querySelector<HTMLAnchorElement>('[data-testid="account-link"]');

  const emailEl =
    document.querySelector<HTMLElement>('[data-email]') ??
    document.querySelector<HTMLElement>('.account-email');
  const email = emailEl?.getAttribute('data-email') ?? emailEl?.textContent?.trim() ?? '';

  const userIdEl = document.querySelector<HTMLElement>('[data-user-id]');
  const userId = userIdEl?.getAttribute('data-user-id') ?? '';

  if (!email && !userId && !accountLink) return null;
  if (!email && !userId) return null;
  return { userId, email };
}

/**
 * Capture the Vestiaire Collective session from the current page.
 *
 * Strategy:
 * 1. Read auth/session token from cookies (try multiple known cookie names)
 * 2. Extract userId + email from embedded script tags
 * 3. Fall back to DOM selectors for userId + email
 * 4. If session cookie found but user info unavailable, report partial
 *
 * Returns null if the user is not logged in (no session cookie found).
 */
export async function captureSession(): Promise<Record<string, unknown> | null> {
  // 1. Look for known Vestiaire auth/session cookies
  const sessionToken =
    getCookieValue('_vc_session') ??
    getCookieValue('_vestiaire_session') ??
    getCookieValue('vc_token') ??
    getCookieValue('vc_auth_token') ??
    getCookieValue('vcsession');

  if (!sessionToken) return null; // Not logged in

  // 2. Strategy A: embedded JSON in script tags
  const userData = extractUserFromPageScripts();
  if (userData) {
    return {
      sessionToken,
      userId: userData.userId,
      email: userData.email,
      detectedAt: Date.now(),
    };
  }

  // 3. Strategy B: DOM selectors for user info
  const userFromDom = extractUserFromDom();
  if (userFromDom) {
    return {
      sessionToken,
      userId: userFromDom.userId,
      email: userFromDom.email,
      detectedAt: Date.now(),
    };
  }

  // 4. Session cookie found but cannot identify user — report partial
  return {
    sessionToken,
    userId: '',
    email: '',
    detectedAt: Date.now(),
  };
}

// ── Listing Scrape ────────────────────────────────────────────────────────────

/**
 * Extract images from a JSON-LD data object's "image" field.
 */
function extractImagesFromJsonLd(data: Record<string, unknown>): string[] {
  const image = data['image'];
  if (typeof image === 'string') return [image];
  if (Array.isArray(image)) {
    return image
      .map((i) => {
        if (typeof i === 'string') return i;
        if (i && typeof i === 'object') {
          const obj = i as Record<string, unknown>;
          return typeof obj['url'] === 'string' ? obj['url'] : null;
        }
        return null;
      })
      .filter((u): u is string => typeof u === 'string' && u.startsWith('http'));
  }
  return [];
}

/** Extract condition label from DOM. Vestiaire uses specific condition labels. */
function extractConditionFromDom(): string | null {
  const condEl =
    document.querySelector<HTMLElement>('[data-testid="product-condition"]') ??
    document.querySelector<HTMLElement>('.product-condition') ??
    document.querySelector<HTMLElement>('[data-testid="condition"]');
  if (condEl) return condEl.textContent?.trim() ?? null;

  // Search for known Vestiaire condition labels in leaf elements
  const known = ['Never worn', 'Very good condition', 'Good condition', 'Fair condition', 'Never Worn', 'Very Good Condition', 'Good Condition', 'Fair Condition'];
  const allEls = document.querySelectorAll<HTMLElement>('span, div, p');
  for (const el of allEls) {
    const text = el.textContent?.trim() ?? '';
    if (known.includes(text) && el.childElementCount === 0) return text;
  }
  return null;
}

/** Extract brand name from DOM. */
function extractBrandFromDom(): string | null {
  const brandEl =
    document.querySelector<HTMLElement>('[data-testid="product-brand"]') ??
    document.querySelector<HTMLElement>('.product-brand') ??
    document.querySelector<HTMLElement>('[itemprop="brand"]');
  return brandEl?.textContent?.trim() ?? null;
}

/** Extract category from breadcrumb navigation. */
function extractCategoryFromDom(): string | null {
  const breadcrumbs = Array.from(
    document.querySelectorAll<HTMLElement>(
      'nav[aria-label="breadcrumb"] a, .breadcrumb a, .breadcrumbs a',
    ),
  );
  if (breadcrumbs.length > 0) {
    return breadcrumbs
      .map((el) => el.textContent?.trim())
      .filter(Boolean)
      .join(' > ');
  }
  return null;
}

/** Extract size from DOM. */
function extractSizeFromDom(): string | null {
  const sizeEl =
    document.querySelector<HTMLElement>('[data-testid="product-size"]') ??
    document.querySelector<HTMLElement>('.product-size') ??
    document.querySelector<HTMLElement>('.item-size');
  return sizeEl?.textContent?.trim() ?? null;
}

/** Extract product images from gallery/carousel. Deduplicates and filters placeholders. */
function extractImagesFromDom(): string[] {
  const imgs = Array.from(
    document.querySelectorAll<HTMLImageElement>(
      '.product-gallery img, .product-images img, [data-testid="product-image"] img, .carousel img',
    ),
  );

  const urls = imgs
    .map((img) => {
      if (img.srcset) {
        const parts = img.srcset.split(',').map((s) => s.trim().split(' ')[0]).filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1];
      }
      return img.src || null;
    })
    .filter((url): url is string => {
      return typeof url === 'string' && url.startsWith('http') && !url.includes('placeholder');
    });

  return [...new Set(urls)];
}

/**
 * Extract the product ID from Vestiaire URL patterns:
 *   /*/p-XXXXXXX.html   -> XXXXXXX
 *   /*/XXXXXXX.shtml    -> XXXXXXX
 */
function extractProductIdFromUrl(pathname: string): string | null {
  // Pattern 1: /path/p-12345678.html
  const pHtmlMatch = pathname.match(/\/p-(\d+)\.html$/);
  if (pHtmlMatch?.[1]) return pHtmlMatch[1];

  // Pattern 2: /path/12345678.shtml
  const shtmlMatch = pathname.match(/\/(\d+)\.shtml$/);
  if (shtmlMatch?.[1]) return shtmlMatch[1];

  return null;
}

/**
 * Attempt to scrape listing data from JSON-LD structured data embedded in the page.
 * Vestiaire product pages include Product schema markup for SEO.
 */
function scrapeFromJsonLd(externalId: string): ScrapedListing | null {
  const ldScripts = document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );
  for (const script of ldScripts) {
    try {
      const data = JSON.parse(script.textContent ?? '') as Record<string, unknown>;
      if (data['@type'] !== 'Product') continue;

      const title = typeof data['name'] === 'string' ? data['name'].trim() : null;
      if (!title) continue;

      // Price and currency from offers object
      let priceCents: number | null = null;
      let currency = 'USD';
      const offers = data['offers'];
      if (offers && typeof offers === 'object') {
        const o = offers as Record<string, unknown>;

        // Prefer priceCurrency from JSON-LD (ISO 4217 code)
        if (typeof o['priceCurrency'] === 'string' && o['priceCurrency'].length === 3) {
          currency = o['priceCurrency'].toUpperCase();
        }

        const price = o['price'];
        if (typeof price === 'string') {
          const parsed = parsePriceWithCurrency(price);
          if (parsed) {
            priceCents = parsed.cents;
            if (parsed.currency !== 'USD' || currency === 'USD') {
              currency = parsed.currency;
            }
          }
        } else if (typeof price === 'number') {
          priceCents = Math.round(price * 100);
        }
      }
      if (priceCents === null) continue;

      const description =
        typeof data['description'] === 'string' ? data['description'].trim() : '';

      let brand: string | null = null;
      const brandObj = data['brand'];
      if (brandObj && typeof brandObj === 'object') {
        const b = brandObj as Record<string, unknown>;
        brand = typeof b['name'] === 'string' ? b['name'] : null;
      }

      const imageUrls = extractImagesFromJsonLd(data);
      const condition = extractConditionFromDom();

      return {
        externalId,
        title,
        priceCents,
        currency,
        description,
        condition,
        brand,
        category: extractCategoryFromDom(),
        size: extractSizeFromDom(),
        imageUrls,
        url: window.location.href,
      };
    } catch {
      // Parse failed, try next script
    }
  }
  return null;
}

/** DOM fallback for product detail page when JSON-LD is absent or incomplete. */
function scrapeProductFromDom(externalId: string): ScrapedListing | null {
  const titleEl =
    document.querySelector<HTMLElement>('[data-testid="product-title"]') ??
    document.querySelector<HTMLElement>('h1');
  const title = titleEl?.textContent?.trim() ?? null;
  if (!title) return null;

  // Price: try to find price element with currency symbol
  const priceEl =
    document.querySelector<HTMLElement>('[data-testid="product-price"]') ??
    document.querySelector<HTMLElement>('.product-price') ??
    document.querySelector<HTMLElement>('[itemprop="price"]');
  const priceText =
    priceEl?.textContent?.trim() ?? priceEl?.getAttribute('content') ?? null;

  let priceCents: number | null = null;
  let currency = 'USD';
  if (priceText) {
    const parsed = parsePriceWithCurrency(priceText);
    if (parsed) {
      priceCents = parsed.cents;
      currency = parsed.currency;
    }
  }
  if (priceCents === null) return null;

  const descEl =
    document.querySelector<HTMLElement>('[data-testid="product-description"]') ??
    document.querySelector<HTMLElement>('.product-description');
  const description = descEl?.textContent?.trim() ?? '';

  return {
    externalId,
    title,
    priceCents,
    currency,
    description,
    condition: extractConditionFromDom(),
    brand: extractBrandFromDom(),
    category: extractCategoryFromDom(),
    size: extractSizeFromDom(),
    imageUrls: extractImagesFromDom(),
    url: window.location.href,
  };
}

/**
 * Scrape the current Vestiaire Collective page.
 *
 * Only scrapes on product detail pages:
 *   - /path/p-XXXXXXX.html
 *   - /path/XXXXXXX.shtml
 *
 * Returns null on any other page (homepage, search, category pages).
 */
export function scrapeListing(): ScrapedListing | null {
  const pathname = window.location.pathname;

  const productId = extractProductIdFromUrl(pathname);
  if (!productId) return null;

  // Strategy 1: JSON-LD (most reliable for Vestiaire product pages)
  const listing = scrapeFromJsonLd(productId);
  if (listing) return listing;

  // Strategy 2: DOM selectors
  return scrapeProductFromDom(productId);
}

// ── Auto-fill ─────────────────────────────────────────────────────────────────

/**
 * Fill the Vestiaire Collective sell form with data from payload.
 * Form is at https://www.vestiairecollective.com/sell/
 *
 * Fields filled: title, description, price, brand, size, condition.
 * Photos are NOT filled (browser security restriction).
 *
 * Per Lister Canonical Section 9.4, human-like random delays are used between
 * all field interactions.
 *
 * Returns true if all required fields (title + price) were filled.
 */
export async function autofillListing(payload: AutofillPayload): Promise<boolean> {
  let allFilled = true;

  // Title (required)
  const titleInput = document.querySelector<HTMLInputElement>(
    'input[name="title"], input[placeholder*="title" i], input[data-testid="sell-title"]',
  );
  if (titleInput) {
    setReactInputValue(titleInput, payload.title);
    await randomDelay(300, 800);
  } else {
    allFilled = false;
  }

  // Description (optional)
  const descInput = document.querySelector<HTMLTextAreaElement>(
    'textarea[name="description"], textarea[placeholder*="description" i], textarea[data-testid="sell-description"]',
  );
  if (descInput) {
    setReactInputValue(descInput, payload.description);
    await randomDelay(300, 800);
  }

  // Price (required) -- convert priceCents to decimal string
  const priceInput = document.querySelector<HTMLInputElement>(
    'input[name="price"], input[placeholder*="price" i], input[data-testid="sell-price"]',
  );
  if (priceInput) {
    const priceDecimal = (payload.priceCents / 100).toFixed(2);
    setReactInputValue(priceInput, priceDecimal);
    await randomDelay(300, 800);
  } else {
    allFilled = false;
  }

  // Brand (optional) -- may trigger autocomplete
  if (payload.brand) {
    const brandInput = document.querySelector<HTMLInputElement>(
      'input[name="brand"], input[placeholder*="brand" i], input[data-testid="sell-brand"]',
    );
    if (brandInput) {
      setReactInputValue(brandInput, payload.brand);
      await randomDelay(500, 1200); // Longer delay for autocomplete dropdown
    }
  }

  // Size (optional)
  if (payload.size) {
    const sizeInput = document.querySelector<HTMLInputElement>(
      'input[name="size"], input[placeholder*="size" i], select[name="size"], input[data-testid="sell-size"]',
    );
    if (sizeInput) {
      if (sizeInput.tagName === 'SELECT') {
        const selectEl = sizeInput as unknown as HTMLSelectElement;
        const options = Array.from(selectEl.options);
        const match = options.find(
          (opt) => opt.text.trim().toLowerCase() === payload.size?.toLowerCase(),
        );
        if (match) {
          selectEl.value = match.value;
          sizeInput.dispatchEvent(new Event('change', { bubbles: true }));
          await randomDelay(200, 500);
        }
      } else {
        setReactInputValue(sizeInput, payload.size);
        await randomDelay(300, 800);
      }
    }
  }

  // Condition (optional -- click matching condition button/radio)
  if (payload.condition) {
    const condButtons = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid*="condition"], input[name="condition"], [role="radio"], .condition-option',
      ),
    );
    const matchingCond = condButtons.find(
      (btn) => btn.textContent?.trim().toLowerCase() === payload.condition?.toLowerCase(),
    );
    if (matchingCond) {
      matchingCond.click();
      await randomDelay(200, 500);
    }
  }

  // NOTE: Photos are NOT filled -- browser security restriction.

  return allFilled;
}

/** Handler object exported for bridge.ts dispatcher */
export const vestiaireHandler = {
  captureSession,
  scrapeListing,
  autofillListing: async (payload: AutofillPayload) => autofillListing(payload),
};
