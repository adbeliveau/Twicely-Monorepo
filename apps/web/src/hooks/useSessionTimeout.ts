"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
const CHECK_INTERVAL_MS = 30_000; // Poll /me every 30s to keep session alive
const WARNING_BEFORE_MS = 60_000; // Show warning 60s before timeout

type SessionTimeoutState = {
  showWarning: boolean;
  secondsRemaining: number;
};

/**
 * Client-side session inactivity timeout hook.
 *
 * - Fetches the timeout setting from /api/platform/settings
 * - Tracks user activity (mouse, keyboard, scroll, click)
 * - Pings /api/platform/auth/me periodically while active (keeps server-side lastActivityAt fresh)
 * - Shows a warning dialog before the session expires
 * - Redirects to /corp/login on timeout or if the server returns 401
 */
export function useSessionTimeout() {
  const router = useRouter();
  const [state, setState] = useState<SessionTimeoutState>({
    showWarning: false,
    secondsRemaining: 0,
  });

  const timeoutMinutesRef = useRef(5); // default, overridden by settings fetch
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsLoadedRef = useRef(false);

  // Record user activity
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // If warning is showing and user interacts, dismiss it
    setState((prev) => (prev.showWarning ? { showWarning: false, secondsRemaining: 0 } : prev));
  }, []);

  // Redirect to login
  const handleLogout = useCallback(() => {
    // Clear the cookie via logout API (fire and forget)
    fetch("/api/platform/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/corp/login?reason=inactive");
  }, [router]);

  // Keep session alive by pinging /me (only if user was recently active)
  const pingSession = useCallback(async () => {
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    const timeoutMs = timeoutMinutesRef.current * 60 * 1000;

    // If user has been idle longer than the timeout, don't ping — let it expire
    if (timeSinceActivity >= timeoutMs) {
      handleLogout();
      return;
    }

    // If user was active recently, ping /me to refresh server-side lastActivityAt
    if (timeSinceActivity < CHECK_INTERVAL_MS + 5000) {
      try {
        const res = await fetch("/api/platform/auth/me");
        if (res.status === 401) {
          // Server already killed the session
          handleLogout();
        }
      } catch {
        // Network error — don't logout, might be temporary
      }
    }
  }, [handleLogout]);

  // Check if we should show warning or logout
  const checkTimeout = useCallback(() => {
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    const timeoutMs = timeoutMinutesRef.current * 60 * 1000;
    const remainingMs = timeoutMs - timeSinceActivity;

    if (remainingMs <= 0) {
      handleLogout();
    } else if (remainingMs <= WARNING_BEFORE_MS) {
      setState({
        showWarning: true,
        secondsRemaining: Math.ceil(remainingMs / 1000),
      });
    } else {
      setState((prev) => (prev.showWarning ? { showWarning: false, secondsRemaining: 0 } : prev));
    }
  }, [handleLogout]);

  // Fetch timeout setting from platform settings
  useEffect(() => {
    if (settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;

    fetch("/api/platform/settings")
      .then((res) => res.json())
      .then((data) => {
        const minutes = data?.settings?.staffInactivityTimeoutMinutes;
        if (typeof minutes === "number" && minutes > 0) {
          timeoutMinutesRef.current = minutes;
        }
      })
      .catch(() => {
        // Use default 5 minutes
      });
  }, []);

  // Set up activity listeners
  useEffect(() => {
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
    };
  }, [recordActivity]);

  // Set up periodic checks
  useEffect(() => {
    // Check timeout every second (for accurate countdown)
    warningTimerRef.current = setInterval(checkTimeout, 1000);

    // Ping server every 30s to keep session alive
    checkTimerRef.current = setInterval(pingSession, CHECK_INTERVAL_MS);

    return () => {
      if (warningTimerRef.current) clearInterval(warningTimerRef.current);
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
    };
  }, [checkTimeout, pingSession]);

  // Dismiss warning and record activity
  const dismissWarning = useCallback(() => {
    recordActivity();
    // Also ping the server to refresh lastActivityAt immediately
    fetch("/api/platform/auth/me").catch(() => {});
  }, [recordActivity]);

  return {
    showWarning: state.showWarning,
    secondsRemaining: state.secondsRemaining,
    dismissWarning,
    timeoutMinutes: timeoutMinutesRef.current,
  };
}
