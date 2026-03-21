'use client';

/**
 * Feature Flag Client Context + Hook (G10.5)
 *
 * FeatureFlagProvider — wraps the app, fetches GET /api/flags on mount,
 * stores resolved boolean map in React context.
 *
 * useFeatureFlag(key) — returns { enabled, isLoading } for a flag key.
 *
 * Only resolved booleans are stored client-side. Raw flag metadata
 * (type, percentage, targeting rules) is never sent to the client.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// ─── Pure logic helpers (exported for unit testing) ──────────────────────────

/**
 * Resolve whether a flag is enabled from the flags map.
 * Defaults to false for unknown keys (consistent with server-side behavior).
 */
export function resolveFlag(flags: Record<string, boolean>, key: string): boolean {
  return flags[key] ?? false;
}

/**
 * Merge initial flags with freshly-fetched flags.
 * Fetched flags win on conflict (server is authoritative after re-evaluation).
 * Falls back to initialFlags when fetched is empty.
 */
export function mergeFlags(
  initial: Record<string, boolean> | undefined,
  fetched: Record<string, boolean>
): Record<string, boolean> {
  return { ...(initial ?? {}), ...fetched };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface FeatureFlagContextValue {
  flags: Record<string, boolean>;
  isLoading: boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface FeatureFlagProviderProps {
  children: ReactNode;
  /**
   * Pre-evaluated flags from a server component (SSR hydration).
   * When provided, the provider renders immediately with no loading state.
   * A background fetch still fires after mount to refresh.
   */
  initialFlags?: Record<string, boolean>;
}

export function FeatureFlagProvider({
  children,
  initialFlags,
}: FeatureFlagProviderProps) {
  // When initialFlags are provided, start with them and no loading state.
  // When absent, start empty with isLoading=true until the fetch completes.
  const [flags, setFlags] = useState<Record<string, boolean>>(initialFlags ?? {});
  const [isLoading, setIsLoading] = useState(!initialFlags);

  useEffect(() => {
    let cancelled = false;

    async function fetchFlags(): Promise<void> {
      try {
        const res = await fetch('/api/flags');
        if (!res.ok) {
          if (!cancelled) setIsLoading(false);
          return;
        }
        const data = (await res.json()) as { flags: Record<string, boolean> };
        if (!cancelled) {
          setFlags((prev) => mergeFlags(prev, data.flags));
          setIsLoading(false);
        }
      } catch {
        // On error, keep whatever flags are already loaded
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchFlags();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FeatureFlagContext.Provider value={{ flags, isLoading }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface FeatureFlagResult {
  enabled: boolean;
  isLoading: boolean;
}

/**
 * Returns the resolved boolean state for a feature flag key.
 *
 * Returns { enabled: false, isLoading: true } until the provider has loaded.
 * Returns { enabled: false, isLoading: false } for unknown keys after load.
 *
 * Must be used within a FeatureFlagProvider.
 */
export function useFeatureFlag(key: string): FeatureFlagResult {
  const ctx = useContext(FeatureFlagContext);

  if (ctx === null) {
    throw new Error('useFeatureFlag must be used within a FeatureFlagProvider');
  }

  return {
    enabled: resolveFlag(ctx.flags, key),
    isLoading: ctx.isLoading,
  };
}
