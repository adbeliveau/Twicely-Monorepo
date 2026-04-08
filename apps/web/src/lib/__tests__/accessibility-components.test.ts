/**
 * G7 Accessibility — Shared Component Static Checks
 * Verifies WCAG 2.1 AA patterns in individual UI components:
 * - NotificationBell: accessible badge label
 * - ListingCard: descriptive aria-label on link
 * - SearchBar: role="search", labelled input, aria-hidden icon
 * - Logo: aria-label on logo link
 * - HubTopbar: sr-only menu toggle, aria-label on avatar
 * - RouteAnnouncer: aria-atomic, skip first render
 * - SkipNav: positioning, focus classes
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const cwd = process.cwd();

function read(rel: string) {
  return readFileSync(join(cwd, rel), 'utf-8');
}

describe('NotificationBell accessibility', () => {
  const SRC = read('src/components/shared/notification-bell.tsx');

  it('badge span has aria-label with unread count', () => {
    expect(SRC).toContain('aria-label={`${unreadCount > 99 ?');
    expect(SRC).toContain('unread notifications');
  });

  it('badge count caps at 99+ in both aria-label and visible text', () => {
    // The aria-label and visible text both use the same 99+ cap
    expect(SRC).toContain("unreadCount > 99 ? '99+' : unreadCount");
    // Should appear at least twice (once for aria-label, once for visible text)
    const matches = (SRC.match(/unreadCount > 99 \? '99\+' : unreadCount/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });

  it('button has sr-only text "Notifications"', () => {
    expect(SRC).toContain('sr-only');
    expect(SRC).toContain('Notifications');
  });

  it('trigger button has relative positioning for badge overlay', () => {
    expect(SRC).toContain('className="relative"');
  });

  it('"Mark all read" button has min touch target size (44px)', () => {
    // WCAG 2.5.5 — minimum touch target 44x44
    expect(SRC).toContain('min-h-[44px]');
    expect(SRC).toContain('min-w-[44px]');
  });
});

describe('ListingCard accessibility', () => {
  const SRC = read('src/components/shared/listing-card.tsx');

  it('card link has descriptive aria-label including title, price, condition', () => {
    expect(SRC).toContain('aria-label={`${listing.title},');
    expect(SRC).toContain('formatPrice(listing.priceCents)');
    expect(SRC).toContain('listing.condition');
  });

  it('image has alt text (falls back to listing title)', () => {
    expect(SRC).toContain('alt={listing.primaryImageAlt ?? listing.title}');
  });

  it('free shipping badge is a plain span without role="status" (static content)', () => {
    expect(SRC).not.toContain('role="status"');
    expect(SRC).toContain('Free Shipping');
  });

  it('title uses semantic heading element (h3)', () => {
    expect(SRC).toContain('<h3');
  });
});

describe('SearchBar accessibility', () => {
  const SRC = read('src/components/shared/search-bar.tsx');

  it('form has role="search"', () => {
    expect(SRC).toContain('role="search"');
  });

  it('form has aria-label="Search listings"', () => {
    expect(SRC).toContain('aria-label="Search listings"');
  });

  it('input has a visually hidden label (sr-only)', () => {
    expect(SRC).toContain('sr-only');
    expect(SRC).toContain('Search for items');
  });

  it('input is associated with label via htmlFor/id', () => {
    expect(SRC).toContain('htmlFor="search-input"');
    expect(SRC).toContain('id="search-input"');
  });

  it('search icon has aria-hidden="true"', () => {
    expect(SRC).toContain('aria-hidden="true"');
  });

  it('input type is "search" (browser semantic)', () => {
    expect(SRC).toContain('type="search"');
  });
});

describe('Logo accessibility', () => {
  const SRC = read('src/components/shared/logo.tsx');

  // The current logo splits the wordmark into separate spans (T / W / ICELY) so
  // a screen reader would read "T W ICELY" without an explicit aria-label.
  it('logo link has aria-label so screen readers announce a clean wordmark', () => {
    expect(SRC).toContain('aria-label="Twicely home"');
  });

  it('logo navigates to home route "/"', () => {
    expect(SRC).toContain('href="/"');
  });
});

describe('HubTopbar accessibility', () => {
  const SRC = read('src/components/hub/hub-topbar.tsx');

  it('hamburger menu button has sr-only label "Toggle menu"', () => {
    expect(SRC).toContain('sr-only');
    expect(SRC).toContain('Toggle menu');
  });

  it('avatar fallback div has aria-label with user name', () => {
    expect(SRC).toContain('aria-label={user.name}');
  });

  it('uses <header> landmark element', () => {
    expect(SRC).toContain('<header');
  });
});

describe('RouteAnnouncer accessibility', () => {
  const SRC = read('src/components/shared/route-announcer.tsx');

  it('container uses role="status" (implicit aria-live="polite", no explicit assertive)', () => {
    expect(SRC).not.toContain('aria-live="assertive"');
    expect(SRC).toContain('role="status"');
  });

  it('container has role="status"', () => {
    expect(SRC).toContain('role="status"');
  });

  it('is visually hidden with sr-only', () => {
    expect(SRC).toContain('className="sr-only"');
  });

  it('uses isFirstRender ref to skip initial announcement on mount', () => {
    expect(SRC).toContain('isFirstRender');
    expect(SRC).toContain('isFirstRender.current = false');
  });

  it('debounces announcement with setTimeout (100ms) to wait for title update', () => {
    expect(SRC).toContain('setTimeout');
    expect(SRC).toContain('100');
  });

  it('clears timer on cleanup (clearTimeout)', () => {
    expect(SRC).toContain('clearTimeout');
  });

  it('falls back to "Page changed" if document.title is empty', () => {
    expect(SRC).toContain("'Page changed'");
  });
});

describe('SkipNav accessibility', () => {
  const SRC = read('src/components/shared/skip-nav.tsx');

  it('link targets "#main-content"', () => {
    expect(SRC).toContain('href="#main-content"');
  });

  it('is sr-only by default (off-screen)', () => {
    expect(SRC).toContain('sr-only');
  });

  it('becomes visible on focus (focus:not-sr-only)', () => {
    expect(SRC).toContain('focus:not-sr-only');
  });

  it('has high z-index when focused (z-[100])', () => {
    expect(SRC).toContain('focus:z-[100]');
  });

  it('text is "Skip to main content"', () => {
    expect(SRC).toContain('Skip to main content');
  });
});
