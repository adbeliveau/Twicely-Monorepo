"use client";

import type React from "react";
import { createContext, useState, useContext, useEffect, useCallback } from "react";
import { clientLogger } from "@/lib/client-logger";

type FeatureFlagContextType = {
  flags: Record<string, boolean>;
  isLoading: boolean;
  isEnabled: (key: string) => boolean;
  refreshFlags: () => Promise<void>;
};

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

export const FeatureFlagProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/public/flags");
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setFlags(data.flags || {});
        } else {
          clientLogger.warn("Feature flags API returned non-JSON response");
        }
      }
    } catch (error) {
      clientLogger.error("Failed to fetch feature flags", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const isEnabled = useCallback(
    (key: string): boolean => {
      return flags[key] === true;
    },
    [flags]
  );

  const refreshFlags = useCallback(async () => {
    setIsLoading(true);
    await fetchFlags();
  }, [fetchFlags]);

  return (
    <FeatureFlagContext.Provider value={{ flags, isLoading, isEnabled, refreshFlags }}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagContext);
  if (context === undefined) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagProvider");
  }
  return context;
};

/**
 * Convenience hook for checking a single flag
 */
export const useFeatureFlag = (key: string): { enabled: boolean; isLoading: boolean } => {
  const { isEnabled, isLoading } = useFeatureFlags();
  return { enabled: isEnabled(key), isLoading };
};
