/**
 * Shared utilities for Twicely content scripts.
 * These are pure functions with no Chrome API or DOM dependencies
 * (except where noted), making them testable in isolation.
 */

/**
 * Returns a Promise that resolves after a random delay within [minMs, maxMs].
 * Use between form field fills to simulate human-like timing.
 * (Lister Canonical Section 9.4 / Section 16.3: randomized 2-8 second delays)
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)),
  );
}

/**
 * Parse a price string like "$25.00", "$1,299", "$0.99" to integer cents.
 * Returns null if the string cannot be parsed as a positive number.
 *
 * Examples:
 *   "$25.00"  -> 2500
 *   "$1,299"  -> 129900
 *   "$0.99"   -> 99
 */
export function parsePriceStringToCents(raw: string): number | null {
  // Strip everything except digits and the decimal point
  const stripped = raw.replace(/[^0-9.]/g, '');
  if (!stripped) return null;
  const asFloat = parseFloat(stripped);
  if (isNaN(asFloat) || asFloat < 0) return null;
  // Round to avoid floating-point imprecision (e.g. 0.99 * 100 = 98.99999...)
  return Math.round(asFloat * 100);
}

/**
 * Set the value of an input or textarea element in a way that triggers
 * React's synthetic event system.
 *
 * React intercepts the native setter on HTMLInputElement.prototype to track
 * controlled component state. Using element.value = x directly bypasses
 * the tracker and React ignores it. This function uses the original setter
 * and then dispatches the required events.
 *
 * @param element - The input or textarea element to update
 * @param value   - The new string value to assign
 */
export function setReactInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    'value',
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(element, value);
  } else {
    // Fallback: direct assignment (may not trigger React state)
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Set text content on a contenteditable element and dispatch the events
 * React/Facebook requires to pick up the change.
 */
export function setContentEditable(element: HTMLElement, value: string): void {
  element.focus();
  element.textContent = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Wait for a DOM element matching `selector` to appear, polling every
 * `intervalMs` ms up to `timeoutMs` total.
 *
 * Returns the element when found, or null on timeout.
 */
export function waitForElement(
  selector: string,
  timeoutMs = 5000,
  intervalMs = 200,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(selector);
    if (found) {
      resolve(found);
      return;
    }

    const start = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(null);
      }
    }, intervalMs);
  });
}

/**
 * Extract a JWT-shaped string (starts with "eyJ") from a cookie string.
 * Returns the first matching token value, or null if not found.
 */
export function extractJwtFromCookies(cookieString: string): string | null {
  const pairs = cookieString.split(';');
  for (const pair of pairs) {
    const value = pair.split('=').slice(1).join('=').trim();
    if (value.startsWith('eyJ')) {
      return value;
    }
  }
  return null;
}

/**
 * Read the value of a named cookie from document.cookie.
 * Returns null if the cookie is not present.
 */
export function getCookieValue(name: string): string | null {
  const prefix = `${name}=`;
  const pairs = document.cookie.split(';');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

/**
 * Attempt to parse the Poshmark __NEXT_DATA__ script tag.
 * Returns the parsed JSON object, or null if not present/invalid.
 */
export function parseNextData(): Record<string, unknown> | null {
  try {
    const el = document.getElementById('__NEXT_DATA__');
    if (!el?.textContent) return null;
    return JSON.parse(el.textContent) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Safely navigate a nested object path, returning null if any segment
 * is absent. Path segments are separated by dots.
 *
 * Example: safeGet(obj, 'props.pageProps.listing.title')
 */
export function safeGet(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current ?? null;
}

/**
 * Parse a price string that may include a currency symbol/code.
 * Returns { cents: number, currency: string } or null.
 *
 * Handles:
 *   "$25.00"        -> { cents: 2500, currency: 'USD' }
 *   "EUR 150,00"    -> { cents: 15000, currency: 'EUR' }
 *   "150,00 EUR"    -> { cents: 15000, currency: 'EUR' }
 *   "GBP 99.99"     -> { cents: 9999, currency: 'GBP' }
 *   "CHF 200.00"    -> { cents: 20000, currency: 'CHF' }
 *   "1 299,00 EUR"  -> { cents: 129900, currency: 'EUR' }
 *   "$1,299.00"     -> { cents: 129900, currency: 'USD' }
 *   "1.299,00 EUR"  -> { cents: 129900, currency: 'EUR' }
 */
export function parsePriceWithCurrency(raw: string): { cents: number; currency: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Reject non-price strings
  const lower = trimmed.toLowerCase();
  if (lower === 'free' || lower.startsWith('contact') || !/\d/.test(trimmed)) {
    return null;
  }

  // Detect currency
  let currency = 'USD';
  if (trimmed.includes('$') || trimmed.toUpperCase().includes('USD')) {
    currency = 'USD';
  } else if (trimmed.includes('\u20AC') || /\bEUR\b/i.test(trimmed)) {
    // Euro sign (€) or EUR code
    currency = 'EUR';
  } else if (trimmed.includes('\u00A3') || /\bGBP\b/i.test(trimmed)) {
    // Pound sign (£) or GBP code
    currency = 'GBP';
  } else if (/\bCHF\b/i.test(trimmed)) {
    currency = 'CHF';
  } else if (/\bSEK\b/i.test(trimmed)) {
    currency = 'SEK';
  } else if (/\bDKK\b/i.test(trimmed)) {
    currency = 'DKK';
  } else if (/\bNOK\b/i.test(trimmed)) {
    currency = 'NOK';
  }

  // Strip currency symbols/codes to isolate the numeric part
  let numeric = trimmed
    .replace(/\bUSD\b|\bEUR\b|\bGBP\b|\bCHF\b|\bSEK\b|\bDKK\b|\bNOK\b/gi, '')
    .replace(/[$\u20AC\u00A3]/g, '')
    .trim();

  // Detect European format: ends with comma followed by exactly 2 digits
  // e.g. "150,00" or "1.299,00" or "1 299,00"
  const isEuropeanFormat = /,\d{2}$/.test(numeric);

  if (isEuropeanFormat) {
    // Remove space-based and period-based thousands separators, then convert comma decimal
    numeric = numeric
      .replace(/\s/g, '')    // Remove spaces (thousands separator)
      .replace(/\./g, '')    // Remove periods (thousands separator in EU format)
      .replace(',', '.');    // Convert comma decimal to period decimal
  } else {
    // US format: remove comma-based thousands separators
    numeric = numeric.replace(/,/g, '').replace(/\s/g, '');
  }

  const asFloat = parseFloat(numeric);
  if (isNaN(asFloat) || asFloat < 0) return null;

  return {
    cents: Math.round(asFloat * 100),
    currency,
  };
}
