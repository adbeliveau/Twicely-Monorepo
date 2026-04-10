'use client';

/**
 * Cookie Consent Banner — G8.3
 *
 * Displayed to visitors when no twicely_consent cookie exists.
 * EU/EEA detection via Cloudflare CF-IPCountry header (passed as prop from server).
 * Conservative default: treat as EU when detection is uncertain.
 *
 * Three categories:
 * 1. Strictly Necessary — always on, cannot be toggled
 * 2. Functional — opt-in (preferences, recently viewed)
 * 3. Analytics — opt-in (usage tracking)
 */

import { useEffect, useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Switch } from '@twicely/ui/switch';
import { Label } from '@twicely/ui/label';
import { updateCookieConsent } from '@/lib/actions/cookie-consent';
import Link from 'next/link';

const CONSENT_COOKIE = 'twicely_consent';
const CONSENT_EXPIRY_DAYS = 365;
const CONSENT_VERSION = '1';

interface ConsentState {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  timestamp: string;
  version: string;
}

interface Props {
  /** Whether the banner is required (from gdpr.cookieConsentRequired setting) */
  consentRequired: boolean;
  /** True if visitor is from EU/EEA (from CF-IPCountry header). Default true (conservative). */
  isEuVisitor?: boolean;
  /** Whether the current user is authenticated */
  isAuthenticated?: boolean;
}

function readConsentCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('='))) as ConsentState;
  } catch {
    return null;
  }
}

function writeConsentCookie(state: ConsentState): void {
  const expires = new Date();
  expires.setDate(expires.getDate() + CONSENT_EXPIRY_DAYS);
  const encoded = encodeURIComponent(JSON.stringify(state));
  // A7: httpOnly intentionally omitted — client JS reads consent state to conditionally load analytics
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const secureSuffix = isLocalhost ? '' : '; Secure';
  document.cookie = `${CONSENT_COOKIE}=${encoded}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${secureSuffix}`;
}

export function CookieConsentBanner({
  consentRequired,
  isEuVisitor = true,
  isAuthenticated = false,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    if (!consentRequired) return undefined;
    const existing = readConsentCookie();
    if (!existing || existing.version !== CONSENT_VERSION) {
      const timeoutId = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [consentRequired]);

  if (!visible) return null;

  async function saveConsent(
    acceptFunctional: boolean,
    acceptAnalytics: boolean
  ): Promise<void> {
    const state: ConsentState = {
      necessary: true,
      functional: acceptFunctional,
      analytics: acceptAnalytics,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    writeConsentCookie(state);

    if (isAuthenticated) {
      await updateCookieConsent({
        functional: acceptFunctional,
        analytics: acceptAnalytics,
      });
    }

    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg md:p-6"
    >
      <div className="mx-auto max-w-4xl">
        {!showDetails ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isEuVisitor
                ? 'We use cookies to improve your experience. You can choose which categories to allow.'
                : 'We use cookies to improve your experience.'}
              {' '}
              <Link href="/p/cookies" className="underline">
                Manage preferences
              </Link>
            </p>
            <div className="flex flex-shrink-0 gap-2">
              {isEuVisitor && (
                <Button variant="outline" size="sm" onClick={() => setShowDetails(true)}>
                  Manage
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => saveConsent(false, false)}>
                Reject all
              </Button>
              <Button size="sm" onClick={() => saveConsent(true, true)}>
                Accept all
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold">Cookie preferences</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Strictly Necessary</Label>
                  <p className="text-xs text-muted-foreground">Required for the site to function. Cannot be disabled.</p>
                </div>
                <Switch checked disabled aria-label="Strictly necessary cookies (always enabled)" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="consent-functional" className="text-sm font-medium">Functional</Label>
                  <p className="text-xs text-muted-foreground">Preferences, recently viewed, language settings.</p>
                </div>
                <Switch
                  id="consent-functional"
                  checked={functional}
                  onCheckedChange={setFunctional}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="consent-analytics" className="text-sm font-medium">Analytics</Label>
                  <p className="text-xs text-muted-foreground">Usage data to improve the platform.</p>
                </div>
                <Switch
                  id="consent-analytics"
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => saveConsent(false, false)}>
                Reject all
              </Button>
              <Button size="sm" onClick={() => saveConsent(functional, analytics)}>
                Save preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
