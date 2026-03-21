/**
 * TheRealReal content script module (H1.3)
 *
 * Handles session capture, listing scrape, and consignment form auto-fill for
 * TheRealReal. This module is NOT an IIFE — it exports a handler object
 * consumed by bridge.ts.
 *
 * TheRealReal is a luxury consignment marketplace (Tier C, session-based).
 * Unlike Poshmark, TRR is a Rails-rendered site with React hydration — there
 * is no __NEXT_DATA__. Session data comes from cookies and meta tags.
 * TRR sets listing prices; the consignor does NOT fill the price field.
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
  parsePriceStringToCents,
  setReactInputValue,
  randomDelay,
  getCookieValue,
} from './shared-utils';

// ── Session Capture ───────────────────────────────────────────────────────────

/**
 * Attempt to extract user info from inline <script> tags.
 * TRR may embed user data as window.__TRR_USER__, window.__INITIAL_STATE__,
 * "currentUser", or a "user" key containing an email address.
 */
function extractUserFromPageScripts(): { userId: string; email: string } | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script:not([src])');
  for (const script of scripts) {
    const text = script.textContent ?? '';

    const patterns = [
      /window\.__TRR_USER__\s*=\s*({.*?});/s,
      /window\.__INITIAL_STATE__\s*=\s*({.*?});/s,
      /"currentUser"\s*:\s*({.*?})/s,
      /"user"\s*:\s*({.*?"email".*?})/s,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        try {
          const data = JSON.parse(match[1]) as Record<string, unknown>;
          const userId = String(data['id'] ?? data['user_id'] ?? '');
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
 * Fall back to extracting user info from DOM elements (account dropdown,
 * profile links, data attributes).
 */
function extractUserFromDom(): { userId: string; email: string } | null {
  // Check account link for presence of signed-in user
  const accountLink =
    document.querySelector<HTMLAnchorElement>('a[href="/account"]') ??
    document.querySelector<HTMLAnchorElement>('a[href*="/account/profile"]');

  // Check for email in account dropdown or profile section
  const emailEl =
    document.querySelector<HTMLElement>('[data-email]') ??
    document.querySelector<HTMLElement>('.account-email');
  const email = emailEl?.getAttribute('data-email') ?? emailEl?.textContent?.trim() ?? '';

  // Check for user ID in data attributes
  const userIdEl = document.querySelector<HTMLElement>('[data-user-id]');
  const userId = userIdEl?.getAttribute('data-user-id') ?? '';

  if (!email && !userId && !accountLink) return null;
  if (!email && !userId) return null;
  return { userId, email };
}

/**
 * Capture the TheRealReal session from the current page.
 *
 * Strategy:
 * 1. Read session_id cookie (try multiple known names)
 * 2. Read CSRF token from <meta name="csrf-token"> (standard Rails pattern)
 * 3. Extract userId + email from embedded script tags
 * 4. Fall back to DOM selectors for userId + email
 * 5. If session cookie + CSRF found but user info unavailable, report partial
 *
 * Returns null if the user is not logged in (no session cookie found).
 *
 * The returned shape matches TrrSessionData in therealreal-connector.ts:
 *   { sessionId: string; csrfToken: string; userId: string; email: string }
 */
export async function captureSession(): Promise<Record<string, unknown> | null> {
  // 1. Get session cookie — try multiple known cookie names
  const sessionId =
    getCookieValue('session_id') ??
    getCookieValue('_session_id') ??
    getCookieValue('_therealreal_session');
  if (!sessionId) return null; // Not logged in

  // 2. Get CSRF token from meta tag (standard Rails pattern)
  const csrfMeta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  const csrfToken = csrfMeta?.content ?? '';

  // 3. Strategy A: embedded JSON in script tags
  const userData = extractUserFromPageScripts();
  if (userData) {
    return {
      sessionId,
      csrfToken,
      userId: userData.userId,
      email: userData.email,
    };
  }

  // 4. Strategy B: DOM selectors for user info
  const userFromDom = extractUserFromDom();
  if (userFromDom) {
    return {
      sessionId,
      csrfToken,
      userId: userFromDom.userId,
      email: userFromDom.email,
    };
  }

  // 5. Session cookie + CSRF found but cannot identify user — report partial
  //    (server can validate by making a test API call)
  if (csrfToken) {
    return {
      sessionId,
      csrfToken,
      userId: '',
      email: '',
    };
  }

  return null;
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

/** Extract TRR condition grade from DOM. Grades: Excellent, Very Good, Good, Fair, Poor */
function extractTrrConditionFromDom(): string | null {
  const condEl =
    document.querySelector<HTMLElement>('[data-testid="condition-grade"]') ??
    document.querySelector<HTMLElement>('.condition-grade') ??
    document.querySelector<HTMLElement>('.item-condition');
  if (condEl) return condEl.textContent?.trim() ?? null;

  // Search for known condition text in leaf elements
  const known = ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor'];
  const allEls = document.querySelectorAll<HTMLElement>('span, div, p');
  for (const el of allEls) {
    const text = el.textContent?.trim() ?? '';
    if (known.includes(text) && el.childElementCount === 0) return text;
  }
  return null;
}

/** Extract brand/designer name from DOM. */
function extractTrrBrandFromDom(): string | null {
  const brandEl =
    document.querySelector<HTMLElement>('[data-testid="product-designer"]') ??
    document.querySelector<HTMLElement>('.product-designer') ??
    document.querySelector<HTMLElement>('[itemprop="brand"]') ??
    document.querySelector<HTMLElement>('.designer-name');
  return brandEl?.textContent?.trim() ?? null;
}

/** Extract category from breadcrumb navigation. */
function extractTrrCategoryFromDom(): string | null {
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
function extractTrrSizeFromDom(): string | null {
  const sizeEl =
    document.querySelector<HTMLElement>('[data-testid="product-size"]') ??
    document.querySelector<HTMLElement>('.product-size') ??
    document.querySelector<HTMLElement>('.item-size');
  return sizeEl?.textContent?.trim() ?? null;
}

/** Extract product images from gallery/carousel. Deduplicates and filters placeholders. */
function extractTrrImagesFromDom(): string[] {
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
 * Attempt to scrape listing data from JSON-LD structured data embedded in the page.
 * TRR product pages include Product schema markup for SEO.
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

      // Price from offers object
      let priceCents: number | null = null;
      const offers = data['offers'];
      if (offers && typeof offers === 'object') {
        const o = offers as Record<string, unknown>;
        const price = o['price'];
        if (typeof price === 'string') {
          priceCents = parsePriceStringToCents(price);
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
      const condition = extractTrrConditionFromDom();

      return {
        externalId,
        title,
        priceCents,
        description,
        condition,
        brand,
        category: extractTrrCategoryFromDom(),
        size: extractTrrSizeFromDom(),
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
    document.querySelector<HTMLElement>('.product-details h1') ??
    document.querySelector<HTMLElement>('h1');
  const title = titleEl?.textContent?.trim() ?? null;
  if (!title) return null;

  const priceEl =
    document.querySelector<HTMLElement>('[data-testid="product-price"]') ??
    document.querySelector<HTMLElement>('.product-price') ??
    document.querySelector<HTMLElement>('[itemprop="price"]');
  const priceText =
    priceEl?.textContent?.trim() ?? priceEl?.getAttribute('content') ?? null;
  const priceCents = priceText ? parsePriceStringToCents(priceText) : null;
  if (priceCents === null) return null;

  const descEl =
    document.querySelector<HTMLElement>('[data-testid="product-description"]') ??
    document.querySelector<HTMLElement>('.product-description') ??
    document.querySelector<HTMLElement>('[itemprop="description"]');
  const description = descEl?.textContent?.trim() ?? '';

  const brandEl =
    document.querySelector<HTMLElement>('[data-testid="product-designer"]') ??
    document.querySelector<HTMLElement>('.product-designer') ??
    document.querySelector<HTMLElement>('[itemprop="brand"]');
  const brand = brandEl?.textContent?.trim() ?? null;

  return {
    externalId,
    title,
    priceCents,
    description,
    condition: extractTrrConditionFromDom(),
    brand,
    category: extractTrrCategoryFromDom(),
    size: extractTrrSizeFromDom(),
    imageUrls: extractTrrImagesFromDom(),
    url: window.location.href,
  };
}

/** Scrape a TRR product detail page at /products/<slug>. */
function scrapeProductDetailPage(): ScrapedListing | null {
  const pathParts = window.location.pathname.split('/');
  const slug = pathParts[pathParts.length - 1] ?? null;
  if (!slug) return null;

  // Strategy 1: JSON-LD (most reliable for TRR product pages)
  const listing = scrapeFromJsonLd(slug);
  if (listing) return listing;

  // Strategy 2: DOM selectors
  return scrapeProductFromDom(slug);
}

/** Scrape a TRR consignment detail page at /account/consignments/<id>. */
function scrapeConsignmentDetailPage(consignmentId: string): ScrapedListing | null {
  const titleEl =
    document.querySelector<HTMLElement>('.consignment-title') ??
    document.querySelector<HTMLElement>('[data-testid="consignment-title"]') ??
    document.querySelector<HTMLElement>('h1, h2');
  const title = titleEl?.textContent?.trim() ?? null;
  if (!title) return null;

  // Price: "Estimated Value" or "List Price" on consignment view
  const priceEl =
    document.querySelector<HTMLElement>('[data-testid="consignment-price"]') ??
    document.querySelector<HTMLElement>('.consignment-price') ??
    document.querySelector<HTMLElement>('.estimated-value');
  const priceText = priceEl?.textContent?.trim() ?? null;
  const priceCents = priceText ? parsePriceStringToCents(priceText) : null;
  if (priceCents === null) return null;

  const descEl =
    document.querySelector<HTMLElement>('[data-testid="consignment-description"]') ??
    document.querySelector<HTMLElement>('.consignment-description');
  const description = descEl?.textContent?.trim() ?? '';

  return {
    externalId: consignmentId,
    title,
    priceCents,
    description,
    condition: extractTrrConditionFromDom(),
    brand: extractTrrBrandFromDom(),
    category: extractTrrCategoryFromDom(),
    size: extractTrrSizeFromDom(),
    imageUrls: extractTrrImagesFromDom(),
    url: window.location.href,
  };
}

/**
 * Scrape the current TheRealReal page.
 *
 * Handles two page types:
 *   - Product detail page: /products/<slug-or-id>
 *   - Consignment detail page: /account/consignments/<id>
 *
 * Returns null on any other page (homepage, search results, category pages).
 */
export function scrapeListing(): ScrapedListing | null {
  const pathname = window.location.pathname;

  if (pathname.startsWith('/products/')) {
    return scrapeProductDetailPage();
  }

  const consignmentMatch = pathname.match(/^\/account\/consignments\/([^/?#]+)/);
  if (consignmentMatch?.[1]) {
    return scrapeConsignmentDetailPage(consignmentMatch[1]);
  }

  // Not on a scrapable page
  return null;
}

// ── Auto-fill ─────────────────────────────────────────────────────────────────

/**
 * Fill the TheRealReal consignment submission form with data from payload.
 *
 * TRR's consignment form is more limited than Poshmark/FB because TRR handles
 * much of the listing process itself. In particular:
 *   - Price is NOT filled (TRR sets the price, not the consignor)
 *   - Photos are NOT filled (browser security restriction)
 *
 * Per Lister Canonical Section 9.4, human-like random delays are used between
 * all field interactions.
 *
 * Returns true if all required fields (title) were filled successfully.
 */
export async function autofillListing(payload: AutofillPayload): Promise<boolean> {
  let allFilled = true;

  // Title / Item Name (required)
  const titleInput = document.querySelector<HTMLInputElement>(
    'input[name="title"], input[name="item_name"], input[placeholder*="Item"], input[placeholder*="Title"], input[data-testid="consignment-title"]',
  );
  if (titleInput) {
    setReactInputValue(titleInput, payload.title);
    await randomDelay(300, 800);
  } else {
    allFilled = false;
  }

  // Description / Notes (optional — do not fail if absent)
  const descInput = document.querySelector<HTMLTextAreaElement>(
    'textarea[name="description"], textarea[name="notes"], textarea[placeholder*="Description"], textarea[data-testid="consignment-description"]',
  );
  if (descInput) {
    setReactInputValue(descInput, payload.description);
    await randomDelay(300, 800);
  }

  // Brand / Designer (optional)
  if (payload.brand) {
    const brandInput = document.querySelector<HTMLInputElement>(
      'input[name="designer"], input[name="brand"], input[placeholder*="Designer"], input[placeholder*="Brand"], input[data-testid="consignment-designer"]',
    );
    if (brandInput) {
      setReactInputValue(brandInput, payload.brand);
      await randomDelay(500, 1200); // Longer delay for autocomplete dropdown
    }
  }

  // Size (optional)
  if (payload.size) {
    const sizeInput = document.querySelector<HTMLInputElement>(
      'input[name="size"], input[placeholder*="Size"], select[name="size"], input[data-testid="consignment-size"]',
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

  // Condition (optional — click matching grade button/radio)
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

  // NOTE: Price is NOT filled — TRR sets the price, not the consignor.
  // NOTE: Photos are NOT filled — browser security restriction.

  return allFilled;
}

/** Handler object exported for bridge.ts dispatcher */
export const therealrealHandler = {
  captureSession,
  scrapeListing,
  autofillListing: async (payload: AutofillPayload) => autofillListing(payload),
};
