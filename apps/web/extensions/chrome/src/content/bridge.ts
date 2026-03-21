// bridge.ts -- Platform dispatcher (H1.2)
// Replaces the H1.1 minimal scaffold with a full dispatcher that delegates
// to platform-specific content script modules.

import type { ExtensionChannel, ScrapedListing, AutofillPayload } from '../shared/types';
import { poshmarkHandler } from './poshmark';
import { fbMarketplaceHandler } from './fb-marketplace';
import { therealrealHandler } from './therealreal';
import { vestiaireHandler } from './vestiaire';

/**
 * Extract an AutofillPayload from an untyped record received over the
 * chrome.runtime message channel. Returns null if required fields are absent.
 */
function parseAutofillPayload(raw: Record<string, unknown>): AutofillPayload | null {
  const { title, description, priceCents, condition, brand, category, size, imageUrls } = raw;
  if (typeof title !== 'string' || typeof description !== 'string') return null;
  if (typeof priceCents !== 'number') return null;
  if (!Array.isArray(imageUrls)) return null;
  return {
    title,
    description,
    priceCents,
    condition: typeof condition === 'string' ? condition : null,
    brand: typeof brand === 'string' ? brand : null,
    category: typeof category === 'string' ? category : null,
    size: typeof size === 'string' ? size : null,
    imageUrls: imageUrls.filter((u): u is string => typeof u === 'string'),
  };
}

(function twicelyCrosslisterBridge() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  type PlatformHandler = {
    captureSession: () => Promise<Record<string, unknown> | null>;
    scrapeListing: () => ScrapedListing | null;
    autofillListing: (payload: AutofillPayload) => Promise<boolean>;
  };

  let channel: ExtensionChannel | null = null;
  let handler: PlatformHandler | null = null;

  // Platform detection + handler assignment
  if (hostname === 'poshmark.com' || hostname === 'www.poshmark.com') {
    channel = 'POSHMARK';
    handler = poshmarkHandler;
  } else if (hostname === 'www.facebook.com' && pathname.startsWith('/marketplace')) {
    channel = 'FB_MARKETPLACE';
    handler = fbMarketplaceHandler;
  } else if (hostname === 'www.therealreal.com') {
    channel = 'THEREALREAL';
    handler = therealrealHandler;
  } else if (hostname === 'www.vestiairecollective.com') {
    channel = 'VESTIAIRE';
    handler = vestiaireHandler;
  }

  if (!channel) return;

  // 1. Report platform detection (preserved from H1.1 for backward compatibility)
  chrome.runtime.sendMessage({
    type: 'PLATFORM_DETECTED',
    channel,
    url: window.location.href,
  });

  // 2. Auto-capture session (non-blocking, best-effort)
  if (handler) {
    handler.captureSession().then((sessionData) => {
      if (sessionData) {
        chrome.runtime.sendMessage({
          type: 'SESSION_CAPTURED',
          channel: channel!,
          sessionData,
        });
      }
    }).catch(() => { /* Silent -- session capture is best-effort */ });
  }

  // 3. Auto-scrape if on a listing detail page
  if (handler) {
    // Poshmark: /listing/<id>
    // FB: /marketplace/item/<id>/
    const isListingPage =
      (channel === 'POSHMARK' && pathname.startsWith('/listing/')) ||
      (channel === 'FB_MARKETPLACE' && /^\/marketplace\/item\/\d+/.test(pathname)) ||
      (channel === 'THEREALREAL' && (
        pathname.startsWith('/products/') ||
        /^\/account\/consignments\/[^/?#]+/.test(pathname)
      )) ||
      (channel === 'VESTIAIRE' && (/\/p-\d+\.html$/.test(pathname) || /\/\d+\.shtml$/.test(pathname)));

    if (isListingPage) {
      // Delay to allow page to render (SPA content may not be in DOM immediately)
      setTimeout(() => {
        const listing = handler!.scrapeListing();
        if (listing) {
          chrome.runtime.sendMessage({
            type: 'LISTING_SCRAPED',
            channel: channel!,
            listing,
          });
        }
      }, 2000); // 2-second delay for SPA hydration
    }
  }

  // 4. Listen for EXECUTE_ACTION from service worker
  chrome.runtime.onMessage.addListener(
    (message: { type: string; action?: string; payload?: Record<string, unknown> }) => {
      if (message.type !== 'EXECUTE_ACTION' || !handler || !channel) return;

      if (message.action === 'SCRAPE_LISTING') {
        const listing = handler.scrapeListing();
        chrome.runtime.sendMessage({
          type: listing ? 'LISTING_SCRAPED' : 'ACTION_RESULT',
          channel,
          ...(listing
            ? { listing }
            : { action: 'SCRAPE_LISTING', success: false, error: 'Could not scrape listing from this page' }),
        });
      }

      if (message.action === 'CAPTURE_SESSION') {
        handler.captureSession().then((sessionData) => {
          if (sessionData) {
            chrome.runtime.sendMessage({ type: 'SESSION_CAPTURED', channel: channel!, sessionData });
          } else {
            chrome.runtime.sendMessage({
              type: 'ACTION_RESULT', channel: channel!, action: 'CAPTURE_SESSION',
              success: false, error: 'User not logged in or session not found',
            });
          }
        }).catch(() => {
          chrome.runtime.sendMessage({
            type: 'ACTION_RESULT', channel: channel!, action: 'CAPTURE_SESSION',
            success: false, error: 'Session capture failed',
          });
        });
      }

      if (message.action === 'AUTOFILL_LISTING' && message.payload) {
        const autofillPayload = parseAutofillPayload(message.payload);
        if (!autofillPayload) {
          chrome.runtime.sendMessage({
            type: 'ACTION_RESULT', channel: channel!, action: 'AUTOFILL_LISTING',
            success: false, error: 'Invalid autofill payload',
          });
          return;
        }
        handler.autofillListing(autofillPayload).then((success) => {
          chrome.runtime.sendMessage({
            type: 'ACTION_RESULT', channel: channel!, action: 'AUTOFILL_LISTING',
            success, error: success ? undefined : 'Could not fill all required fields',
          });
        }).catch(() => {
          chrome.runtime.sendMessage({
            type: 'ACTION_RESULT', channel: channel!, action: 'AUTOFILL_LISTING',
            success: false, error: 'Auto-fill failed unexpectedly',
          });
        });
      }
    },
  );
})();
