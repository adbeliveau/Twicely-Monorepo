'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { logoutStaffAction } from '@/lib/actions/staff-login';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@twicely/ui/alert-dialog';

const HARD_LIMIT_WARNING_SECONDS = 300;
const ACTIVITY_DEBOUNCE_MS = 300;
const HEARTBEAT_INTERVAL_MS = 60_000;

type WarningVariant = 'inactivity' | 'hard-limit' | null;

interface SessionTimeoutContextValue { variant: WarningVariant }
const SessionTimeoutContext = createContext<SessionTimeoutContextValue>({ variant: null });
export function useSessionTimeout(): SessionTimeoutContextValue {
  return useContext(SessionTimeoutContext);
}

interface HeartbeatResponse {
  success: boolean;
  sessionValid: boolean;
  absoluteExpiresAt?: string;
  inactivityTimeoutMs?: number;
  warningSeconds?: number;
  reason?: string;
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m} minute${m !== 1 ? 's' : ''} and ${sec} second${sec !== 1 ? 's' : ''}`;
  return `${s} second${s !== 1 ? 's' : ''}`;
}

export function StaffSessionTimeoutProvider({
  children,
  initialExpiresAt,
}: {
  children: React.ReactNode;
  initialExpiresAt: string;
}): React.ReactElement {
  const [inactivityTimeoutMs, setInactivityTimeoutMs] = useState(5 * 60 * 1000);
  const [warningSeconds, setWarningSeconds] = useState(60);
  const [absoluteExpiresAt, setAbsoluteExpiresAt] = useState(() => new Date(initialExpiresAt).getTime());
  const [variant, setVariant] = useState<WarningVariant>(null);
  const [countdownMs, setCountdownMs] = useState(0);

  const [initialNow] = useState(() => Date.now());
  const lastActivityRef = useRef<number>(initialNow);
  const inactivityMsRef = useRef<number>(5 * 60 * 1000);
  const warnSecsRef = useRef<number>(60);
  const expiresAtRef = useRef<number>(new Date(initialExpiresAt).getTime());
  const variantRef = useRef<WarningVariant>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoggedOutRef = useRef(false);

  const performLogout = useCallback(async (reason: 'inactivity' | 'expired') => {
    if (isLoggedOutRef.current) return;
    isLoggedOutRef.current = true;
    try { await logoutStaffAction(); } catch { /* redirect in progress */ }
    window.location.href = `/login?reason=${reason}`;
  }, []);

  const callHeartbeat = useCallback(async (): Promise<HeartbeatResponse | null> => {
    try {
      const res = await fetch('/api/hub/session/heartbeat', { method: 'POST' });
      return (await res.json()) as HeartbeatResponse;
    } catch { return null; }
  }, []);

  const applyHeartbeatData = useCallback((data: HeartbeatResponse) => {
    lastActivityRef.current = Date.now();
    if (data.absoluteExpiresAt) {
      const t = new Date(data.absoluteExpiresAt).getTime();
      expiresAtRef.current = t;
      setAbsoluteExpiresAt(t);
    }
    if (typeof data.inactivityTimeoutMs === 'number') {
      inactivityMsRef.current = data.inactivityTimeoutMs;
      setInactivityTimeoutMs(data.inactivityTimeoutMs);
    }
    if (typeof data.warningSeconds === 'number') {
      warnSecsRef.current = data.warningSeconds;
      setWarningSeconds(data.warningSeconds);
    }
  }, []);

  const handleStayLoggedIn = useCallback(async () => {
    const data = await callHeartbeat();
    if (!data?.sessionValid) { await performLogout('inactivity'); return; }
    applyHeartbeatData(data);
    variantRef.current = null;
    setVariant(null);
  }, [callHeartbeat, performLogout, applyHeartbeatData]);

  const handleLogOutNow = useCallback(async () => {
    try { await logoutStaffAction(); } catch { /* redirect in progress */ }
    window.location.href = '/login';
  }, []);

  // Tick every second: check expiry + update modal countdown
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const msUntilAbsolute = expiresAtRef.current - now;
      const msSinceActivity = now - lastActivityRef.current;
      const hardWarnMs = HARD_LIMIT_WARNING_SECONDS * 1000;
      const warnMs = warnSecsRef.current * 1000;

      if (msUntilAbsolute <= 0) { void performLogout('expired'); return; }
      if (msSinceActivity >= inactivityMsRef.current) { void performLogout('inactivity'); return; }

      const msUntilInactivity = inactivityMsRef.current - msSinceActivity;
      if (msUntilAbsolute <= hardWarnMs) {
        if (variantRef.current !== 'hard-limit') { variantRef.current = 'hard-limit'; setVariant('hard-limit'); }
        setCountdownMs(msUntilAbsolute);
      } else if (msUntilInactivity <= warnMs) {
        if (variantRef.current !== 'inactivity') { variantRef.current = 'inactivity'; setVariant('inactivity'); }
        setCountdownMs(msUntilInactivity);
      } else if (variantRef.current !== null) {
        variantRef.current = null;
        setVariant(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [performLogout]);

  // Periodic heartbeat every 60s
  useEffect(() => {
    const id = setInterval(async () => {
      const data = await callHeartbeat();
      if (!data?.sessionValid) {
        await performLogout(data?.reason === 'inactive' ? 'inactivity' : 'expired');
        return;
      }
      applyHeartbeatData(data);
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [callHeartbeat, performLogout, applyHeartbeatData]);

  // Activity event listeners — debounced to 300ms
  useEffect(() => {
    const events: Array<keyof DocumentEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const onActivity = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => { lastActivityRef.current = Date.now(); }, ACTIVITY_DEBOUNCE_MS);
    };
    for (const e of events) document.addEventListener(e, onActivity, { passive: true });
    return () => {
      for (const e of events) document.removeEventListener(e, onActivity);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // visibilitychange: recalculate on tab return
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now >= expiresAtRef.current) { await performLogout('expired'); return; }
      if (now - lastActivityRef.current >= inactivityMsRef.current) { await performLogout('inactivity'); }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [performLogout]);

  // Sync refs when state changes
  useEffect(() => { inactivityMsRef.current = inactivityTimeoutMs; }, [inactivityTimeoutMs]);
  useEffect(() => { warnSecsRef.current = warningSeconds; }, [warningSeconds]);
  useEffect(() => { expiresAtRef.current = absoluteExpiresAt; }, [absoluteExpiresAt]);

  return (
    <SessionTimeoutContext.Provider value={{ variant }}>
      {children}
      <AlertDialog open={variant !== null}>
        <AlertDialogContent>
          {variant === 'inactivity' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Your session is about to expire</AlertDialogTitle>
                <AlertDialogDescription>
                  <span aria-live="assertive" aria-atomic="true">
                    You will be logged out in {formatCountdown(countdownMs)} due to inactivity.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => void handleLogOutNow()}>Log Out Now</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleStayLoggedIn()}>Stay Logged In</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {variant === 'hard-limit' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Session ending soon</AlertDialogTitle>
                <AlertDialogDescription>
                  <span aria-live="polite" aria-atomic="true">
                    Your session expires in {formatCountdown(countdownMs)}. Please save your work.
                  </span>
                  <span className="mt-1 block text-sm">This session cannot be extended.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => void handleLogOutNow()}>Log Out Now</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </SessionTimeoutContext.Provider>
  );
}
