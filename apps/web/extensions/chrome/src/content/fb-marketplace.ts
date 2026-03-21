/**
 * Facebook Marketplace content script module (H1.2)
 *
 * Handles session capture, listing scrape, and form auto-fill for
 * Facebook Marketplace. This module is NOT an IIFE — it exports a
 * handler object consumed by bridge.ts.
 *
 * FB Marketplace is Tier B (OAuth/Graph API). The extension's role here
 * is lighter than Poshmark:
 *   - Session capture = confirm login + capture c_user cookie
 *   - Listing scrape  = read DOM (Facebook has no __NEXT_DATA__)
 *   - Auto-fill       = fill Marketplace creation form
 *
 * Facebook uses randomized hash-based class names. ARIA roles, data-testid,
 * and structural selectors are used exclusively.
 *
 * No fetch() or XHR calls are made from this module.
 *
 * Canonical refs:
 *   - Lister Canonical §9.1 (FB = Tier B, OAuth)
 *   - Lister Canonical §14 (policy/transform engine)
 */

import type { ScrapedListing, AutofillPayload } from '../shared/types';
import {
  parsePriceStringToCents,
  setReactInputValue,
  setContentEditable,
  randomDelay,
  getCookieValue,
} from './shared-utils';

// ── Session Capture ───────────────────────────────────────────────────────────

/**
 * Capture the Facebook Marketplace session from the current page.
 *
 * FB Marketplace is Tier B (OAuth). The extension captures the `c_user`
 * cookie (Facebook user ID) as a login confirmation signal.
 * The primary auth token is managed server-side via OAuth callback.
 *
 * Returns null if the user is not logged in (c_user cookie absent).
 */
export async function captureSession(): Promise<Record<string, unknown> | null> {
  const fbUserId = getCookieValue('c_user');
  if (!fbUserId) {
    // Not logged in — do not report
    return null;
  }

  return {
    fbUserId,
    isLoggedIn: true,
    detectedAt: Date.now(),
  };
}

// ── Listing Scrape ────────────────────────────────────────────────────────────

/**
 * Scrape the current Facebook Marketplace listing detail page.
 * Only call this on URLs matching /marketplace/item/<id>.
 *
 * Facebook uses randomized class names — all selectors rely on
 * ARIA roles, data-testid, and structural HTML (h1, img, etc.).
 *
 * Images are lazy-loaded; a MutationObserver waits up to 3 seconds
 * for real image URLs to appear.
 *
 * Returns null if essential data cannot be extracted.
 */
export function scrapeListing(): ScrapedListing | null {
  const match = window.location.pathname.match(/^\/marketplace\/item\/(\d+)/);
  const externalId = match?.[1] ?? null;
  if (!externalId) return null;

  // Title: Facebook renders the item title in the main content heading
  const mainContent = document.querySelector<HTMLElement>('[role="main"]');
  if (!mainContent) return null;

  const titleEl = mainContent.querySelector<HTMLElement>('h1');
  const title = titleEl?.textContent?.trim() ?? null;
  if (!title) return null;

  // Price: typically the first text node containing "$" near the title
  const priceCents = extractFbPrice(mainContent);
  if (priceCents === null) return null;

  // Description: large text block below title/price
  const description = extractFbDescription(mainContent);

  // Condition: badge text — "New", "Used - Like New", "Used - Good", "Used - Fair"
  const condition = extractFbCondition(mainContent);

  // Category: breadcrumb or category label
  const category = extractFbCategory(mainContent);

  // Images: carousel media gallery
  const imageUrls = extractFbImages(mainContent);

  return {
    externalId,
    title,
    priceCents,
    description,
    condition,
    brand: null, // FB Marketplace does not surface brand as a structured field
    category,
    size: null,   // FB Marketplace does not surface size as a structured field
    imageUrls,
    url: window.location.href,
  };
}

function extractFbPrice(container: HTMLElement): number | null {
  // Find all span elements; look for one containing a "$" sign near the title
  const spans = Array.from(container.querySelectorAll<HTMLElement>('span'));
  for (const span of spans) {
    const text = span.textContent?.trim() ?? '';
    if (text.startsWith('$') && /\$[\d,]+/.test(text)) {
      const cents = parsePriceStringToCents(text);
      if (cents !== null) return cents;
    }
  }
  return null;
}

function extractFbDescription(container: HTMLElement): string {
  // Description is typically the longest text block after the price
  // Use data-testid if available, otherwise find the largest block of text
  const descEl =
    container.querySelector<HTMLElement>('[data-testid="marketplace_pdp_description"]') ??
    container.querySelector<HTMLElement>('[aria-label="Description"]');

  if (descEl) return descEl.textContent?.trim() ?? '';

  // Fallback: find the div/span with the most text content that is not the title
  const textBlocks = Array.from(
    container.querySelectorAll<HTMLElement>('div[dir="auto"], span[dir="auto"]'),
  );
  const longest = textBlocks.reduce<HTMLElement | null>((best, el) => {
    const len = el.textContent?.length ?? 0;
    const bestLen = best?.textContent?.length ?? 0;
    return len > bestLen ? el : best;
  }, null);

  return longest?.textContent?.trim() ?? '';
}

function extractFbCondition(container: HTMLElement): string | null {
  // Condition values: "New", "Used - Like New", "Used - Good", "Used - Fair"
  const known = ['New', 'Used - Like New', 'Used - Good', 'Used - Fair'];
  const all = Array.from(container.querySelectorAll<HTMLElement>('span, div'));
  for (const el of all) {
    const text = el.textContent?.trim() ?? '';
    if (known.includes(text)) return text;
  }
  return null;
}

function extractFbCategory(container: HTMLElement): string | null {
  // Look for category via aria-label or data-testid
  const catEl =
    container.querySelector<HTMLElement>('[data-testid="marketplace_pdp_category"]') ??
    container.querySelector<HTMLElement>('[aria-label="Category"]');
  if (catEl) return catEl.textContent?.trim() ?? null;
  return null;
}

function extractFbImages(container: HTMLElement): string[] {
  // Facebook Marketplace images are in the media gallery
  // Use img elements; prefer scontent URLs with large dimensions (no s_OR prefix = full size)
  const imgs = Array.from(
    container.querySelectorAll<HTMLImageElement>('img[src*="scontent"], img[data-visualcompletion]'),
  );

  const urls = imgs
    .map((img) => {
      // Prefer srcset for higher resolution
      if (img.srcset) {
        const parts = img.srcset.split(',').map((s) => s.trim().split(' ')[0]).filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1];
      }
      return img.src || null;
    })
    .filter((url): url is string => {
      return typeof url === 'string' && url.startsWith('http') && !url.includes('placeholder');
    });

  // Deduplicate
  return [...new Set(urls)];
}

// ── Auto-fill ─────────────────────────────────────────────────────────────────

/**
 * Fill the Facebook Marketplace listing creation form with data from payload.
 *
 * Facebook forms use ARIA labels and placeholders rather than class names.
 * Both <input> and contenteditable <div> elements are handled.
 *
 * Photo upload is NOT automated (browser security restriction).
 * Returns true if all required fields were filled successfully.
 */
export async function autofillListing(payload: AutofillPayload): Promise<boolean> {
  let allFilled = true;

  // Title
  const titleInput =
    document.querySelector<HTMLInputElement>('[aria-label="Title"]') ??
    document.querySelector<HTMLInputElement>('[placeholder="Title"]') ??
    document.querySelector<HTMLInputElement>('[data-testid="marketplace_listing_form_title"]');

  if (titleInput) {
    setReactInputValue(titleInput, payload.title);
    await randomDelay(300, 800);
  } else {
    // Try contenteditable fallback
    const titleEditable = document.querySelector<HTMLElement>(
      '[aria-label="Title"][contenteditable="true"]',
    );
    if (titleEditable) {
      setContentEditable(titleEditable, payload.title);
      await randomDelay(300, 800);
    } else {
      allFilled = false;
    }
  }

  // Price: convert cents to whole dollars string
  const priceInput =
    document.querySelector<HTMLInputElement>('[aria-label="Price"]') ??
    document.querySelector<HTMLInputElement>('[placeholder="Price"]') ??
    document.querySelector<HTMLInputElement>('[data-testid="marketplace_listing_form_price"]');

  if (priceInput) {
    const dollars = Math.floor(payload.priceCents / 100).toString();
    setReactInputValue(priceInput, dollars);
    await randomDelay(300, 800);
  } else {
    allFilled = false;
  }

  // Description: may be textarea or contenteditable
  const descTextarea = document.querySelector<HTMLTextAreaElement>(
    '[aria-label="Description"], [placeholder*="Description"]',
  );
  if (descTextarea) {
    setReactInputValue(descTextarea, payload.description);
    await randomDelay(300, 800);
  } else {
    const descEditable = document.querySelector<HTMLElement>(
      '[aria-label="Description"][contenteditable="true"], [data-testid="marketplace_listing_form_description"]',
    );
    if (descEditable) {
      setContentEditable(descEditable, payload.description);
      await randomDelay(300, 800);
    }
    // Description not required — do not fail
  }

  // Condition (optional — click matching condition radio/button)
  if (payload.condition) {
    const condButtons = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid*="condition"], [aria-label*="condition"], [role="radio"]',
      ),
    );
    const match = condButtons.find(
      (btn) => btn.textContent?.trim().toLowerCase() === payload.condition?.toLowerCase(),
    );
    if (match) {
      match.click();
      await randomDelay(200, 500);
    }
  }

  return allFilled;
}

/** Handler object exported for bridge.ts dispatcher */
export const fbMarketplaceHandler = {
  captureSession,
  scrapeListing,
  autofillListing: async (payload: AutofillPayload) => autofillListing(payload),
};
