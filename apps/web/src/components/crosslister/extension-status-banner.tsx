'use client';

/**
 * Extension Status Banner — shows browser extension install/connected/disconnected state.
 * Shown on /my/selling/crosslist for Tier C channel (Poshmark, The RealReal) users.
 * Source: H1.4 install prompt §2.5
 *
 * Three visual states:
 * 1. Connected (green): extension detected via sourceParam or recent lastAuthAt
 * 2. Not installed + no Tier C accounts (info/blue): prompt to install
 * 3. Not detected + Tier C accounts exist (warning/amber): reconnect warning
 */

import { CheckCircle, AlertTriangle, Info } from 'lucide-react';

// TODO: Replace PLACEHOLDER_ID with the real Chrome Web Store extension ID when published.
const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/twicely-crosslister/PLACEHOLDER_ID';

interface ExtensionStatusBannerProps {
  hasExtension: boolean;
  lastHeartbeatAt: Date | null;
  tierCAccountCount: number;
  /** '?source=extension' confirms extension presence for this page load */
  sourceParam: string | null;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return '1 hour ago';
  return `${diffHr} hours ago`;
}

export function ExtensionStatusBanner({
  hasExtension,
  lastHeartbeatAt,
  tierCAccountCount,
  sourceParam,
}: ExtensionStatusBannerProps) {
  const isConfirmed = sourceParam === 'extension' || hasExtension;

  // State 1: Extension connected — show green indicator
  if (isConfirmed) {
    const timeText = lastHeartbeatAt ? formatRelativeTime(lastHeartbeatAt) : null;
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
        <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
        <span>
          Browser extension connected
          {timeText && (
            <span className="text-green-600 dark:text-green-400"> &middot; last active {timeText}</span>
          )}
        </span>
      </div>
    );
  }

  // State 3: Extension not detected + Tier C accounts exist — warning
  if (tierCAccountCount > 0) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1">
          <p className="font-medium">Extension not detected</p>
          <p>
            Session-based platforms (Poshmark, The RealReal) may lose connection without the
            extension active.{' '}
            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Reinstall the Twicely extension
            </a>
          </p>
        </div>
      </div>
    );
  }

  // State 2: Extension not installed + no Tier C accounts — info prompt
  return (
    <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="space-y-1">
        <p>
          Install the Twicely browser extension to connect Poshmark and The RealReal. These
          platforms require session-based authentication via the extension.
        </p>
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2"
        >
          Add to Chrome
        </a>
      </div>
    </div>
  );
}
