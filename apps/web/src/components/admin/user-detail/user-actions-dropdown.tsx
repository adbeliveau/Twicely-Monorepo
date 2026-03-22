'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { suspendUserAction, unsuspendUserAction, warnUserAction } from '@/lib/actions/admin-users';

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
  isSeller: _isSeller = false, payoutsEnabled = false,
  canUpdateUser = false, canUpdateSeller: _canUpdateSeller = false,
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

  return (
    <div className="flex items-center gap-2">
      {/* Edit button */}
      <button
        className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        disabled={pending}
        onClick={() => { window.location.href = `/usr/${userId}/edit`; }}
      >
        Edit
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
              <button
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => { setIsOpen(false); window.location.href = `/my/messages?to=${userId}`; }}
              >
                <svg className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Send Message
              </button>

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
              {canUpdateUser && (
                <>
                  <div className="mt-1 border-t border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Moderation
                  </div>
                  <button
                    onClick={handleWarn}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-4 w-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Issue Warning
                  </button>
                  <button
                    onClick={() => { setIsOpen(false); window.location.href = `/mod/enforcement/new?userId=${userId}`; }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Apply Restriction
                  </button>
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
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isBanned ? 'Activate Account' : 'Suspend Account'}
                  </button>
                  {!isBanned && (
                    <button
                      onClick={() => {
                        const reason = prompt('Reason for banning:');
                        if (!reason) return;
                        setIsOpen(false);
                        startTransition(async () => {
                          const res = await suspendUserAction({ userId, reason, permanent: true });
                          setResult(res.error ?? 'Account banned');
                        });
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Ban Account
                    </button>
                  )}
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
