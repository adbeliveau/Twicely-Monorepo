'use client';

/**
 * Cookie Preferences Form — G8.3
 *
 * Used on /p/cookies page.
 * Shows current consent state from the twicely_consent cookie
 * and allows modification. Saves via updateCookieConsent action.
 */

import { useState, useEffect } from 'react';
import { Switch } from '@twicely/ui/switch';
import { Label } from '@twicely/ui/label';
import { Button } from '@twicely/ui/button';
import { updateCookieConsent } from '@/lib/actions/cookie-consent';

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

function readConsentCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  try {
    return JSON.parse(
      decodeURIComponent(match.split('=').slice(1).join('='))
    ) as ConsentState;
  } catch {
    return null;
  }
}

function writeConsentCookie(state: ConsentState): void {
  const expires = new Date();
  expires.setDate(expires.getDate() + CONSENT_EXPIRY_DAYS);
  const encoded = encodeURIComponent(JSON.stringify(state));
  document.cookie = `${CONSENT_COOKIE}=${encoded}; expires=${expires.toUTCString()}; path=/; SameSite=Lax; Secure`;
}

interface Props {
  isAuthenticated: boolean;
}

export function CookiePreferencesForm({ isAuthenticated }: Props) {
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = readConsentCookie();
    if (existing) {
      setFunctional(existing.functional);
      setAnalytics(existing.analytics);
    }
  }, []);

  async function handleSave(): Promise<void> {
    const state: ConsentState = {
      necessary: true,
      functional,
      analytics,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    writeConsentCookie(state);

    if (isAuthenticated) {
      await updateCookieConsent({ functional, analytics });
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Strictly Necessary — always on */}
        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Strictly Necessary</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Required for the site to function correctly. Includes session cookies,
                authentication, and security tokens. Cannot be disabled.
              </p>
            </div>
            <Switch
              checked
              disabled
              aria-label="Strictly necessary cookies (always enabled)"
            />
          </div>
        </div>

        {/* Functional */}
        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Label htmlFor="pref-functional" className="text-sm font-semibold">
                Functional
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Enables enhanced functionality such as saved preferences,
                recently viewed items, and language settings.
              </p>
            </div>
            <Switch
              id="pref-functional"
              checked={functional}
              onCheckedChange={setFunctional}
              aria-label="Functional cookies"
            />
          </div>
        </div>

        {/* Analytics */}
        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Label htmlFor="pref-analytics" className="text-sm font-semibold">
                Analytics
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Helps us understand how you use Twicely so we can improve the platform.
                Usage data is anonymized and never sold.
              </p>
            </div>
            <Switch
              id="pref-analytics"
              checked={analytics}
              onCheckedChange={setAnalytics}
              aria-label="Analytics cookies"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save preferences</Button>
        {saved && (
          <p className="text-sm text-muted-foreground">Preferences saved.</p>
        )}
      </div>
    </div>
  );
}
