'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { suspendUserAction, unsuspendUserAction, warnUserAction } from '@/lib/actions/admin-users';
import {
  holdPayoutsAction, releasePayoutsAction, resetPasswordAction, overridePerformanceBandAction,
} from '@/lib/actions/admin-users-management';

interface UserActionsDropdownProps {
  userId: string;
  isBanned: boolean;
  canImpersonate?: boolean;
  isSeller?: boolean;
  payoutsEnabled?: boolean;
  currentBand?: string;
  canUpdateUser?: boolean;
  canUpdateSeller?: boolean;
}

export function UserActionsDropdown({
  userId, isBanned, canImpersonate = false,
  isSeller = false, payoutsEnabled = false,
  canUpdateUser = false, canUpdateSeller = false,
}: UserActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSuspendToggle() {
    const reason = prompt('Reason:');
    if (!reason && !isBanned) return;
    setIsOpen(false);
    startTransition(async () => {
      const res = isBanned
        ? await unsuspendUserAction({ userId })
        : await suspendUserAction({ userId, reason: reason ?? '' });
      setResult(res.error ?? (isBanned ? 'Activated' : 'Suspended'));
    });
  }

  function handleWarn() {
    const msg = prompt('Warning message:');
    if (!msg) return;
    setIsOpen(false);
    startTransition(async () => {
      const res = await warnUserAction({ userId, message: msg });
      setResult(res.error ?? 'Warning sent');
    });
  }

  function handleImpersonate() {
    if (!confirm('View as this user? You will be in read-only mode.')) return;
    setIsOpen(false);
    startTransition(async () => {
      const res = await fetch('/api/hub/impersonation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId }),
        redirect: 'follow',
      });
      if (res.ok || res.redirected) {
        window.location.href = res.url;
      } else {
        setResult('Failed to start impersonation');
      }
    });
  }

  function handleHoldRelease() {
    setIsOpen(false);
    if (payoutsEnabled) {
      const reason = prompt('Reason for holding payouts:');
      if (!reason) return;
      startTransition(async () => {
        const res = await holdPayoutsAction({ userId, reason });
        setResult(res.error ?? 'Payouts held');
      });
    } else {
      startTransition(async () => {
        const res = await releasePayoutsAction({ userId });
        setResult(res.error ?? 'Payouts released');
      });
    }
  }

  function handleResetPassword() {
    if (!confirm('Send password reset for this user?')) return;
    setIsOpen(false);
    startTransition(async () => {
      const res = await resetPasswordAction({ userId });
      setResult(res.error ?? 'Password reset initiated');
    });
  }

  function handleBandOverride() {
    const band = prompt('New band (EMERGING, ESTABLISHED, TOP_RATED, POWER_SELLER):');
    if (!band) return;
    const reason = prompt('Reason:');
    if (!reason) return;
    setIsOpen(false);
    startTransition(async () => {
      const res = await overridePerformanceBandAction({
        userId,
        newBand: band as 'EMERGING' | 'ESTABLISHED' | 'TOP_RATED' | 'POWER_SELLER',
        reason,
      });
      setResult(res.error ?? `Band set to ${band}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {/* Edit button */}
      <button
        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        disabled={pending}
        onClick={handleResetPassword}
      >
        Reset Password
      </button>

      {/* Actions Dropdown */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Actions
          <svg
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
            <div className="py-1">
              {/* Communication */}
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Communication
              </div>
              {canUpdateUser && (
                <button
                  onClick={handleWarn}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <svg className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Send Warning
                </button>
              )}

              {/* Access */}
              {canImpersonate && (
                <>
                  <div className="mt-1 border-t border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Access
                  </div>
                  <button
                    onClick={handleImpersonate}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-4 w-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Login as User
                  </button>
                </>
              )}

              {/* Moderation */}
              {(canUpdateUser || canUpdateSeller) && (
                <>
                  <div className="mt-1 border-t border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Moderation
                  </div>
                  {canUpdateSeller && isSeller && (
                    <>
                      <button
                        onClick={handleHoldRelease}
                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {payoutsEnabled ? 'Hold Payouts' : 'Release Payouts'}
                      </button>
                      <button
                        onClick={handleBandOverride}
                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                        Override Band
                      </button>
                    </>
                  )}
                </>
              )}

              {/* Account Status */}
              {canUpdateUser && (
                <>
                  <div className="mt-1 border-t border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Account Status
                  </div>
                  <button
                    onClick={handleSuspendToggle}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm ${
                      isBanned
                        ? 'text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                        : 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                    }`}
                  >
                    {isBanned ? (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Activate Account
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        Suspend Account
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {result && (
        <span className="text-xs text-gray-500">{result}</span>
      )}
    </div>
  );
}
