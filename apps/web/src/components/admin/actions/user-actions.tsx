'use client';

import { useTransition, useState } from 'react';
import { suspendUserAction, unsuspendUserAction, warnUserAction } from '@/lib/actions/admin-users';
import {
  holdPayoutsAction, releasePayoutsAction, resetPasswordAction, overridePerformanceBandAction,
} from '@/lib/actions/admin-users-management';

interface UserActionsProps {
  userId: string;
  isBanned: boolean;
  canImpersonate?: boolean;
  isSeller?: boolean;
  payoutsEnabled?: boolean;
  currentBand?: string;
  canUpdateUser?: boolean;
  canUpdateSeller?: boolean;
}

const BANDS = ['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER'] as const;

export function UserActions({
  userId, isBanned, canImpersonate = false,
  isSeller = false, payoutsEnabled = false, currentBand,
  canUpdateUser = false, canUpdateSeller = false,
}: UserActionsProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [showWarn, setShowWarn] = useState(false);
  const [warnMessage, setWarnMessage] = useState('');
  const [showBandOverride, setShowBandOverride] = useState(false);
  const initialBand = BANDS.includes(currentBand as typeof BANDS[number])
    ? (currentBand as typeof BANDS[number])
    : 'ESTABLISHED';
  const [newBand, setNewBand] = useState<typeof BANDS[number]>(initialBand);
  const [bandReason, setBandReason] = useState('');

  function handleSuspendToggle() {
    const reason = prompt('Reason for suspension:');
    if (!reason) return;
    startTransition(async () => {
      const res = isBanned
        ? await unsuspendUserAction({ userId })
        : await suspendUserAction({ userId, reason });
      setResult(res.error ?? (isBanned ? 'User unsuspended' : 'User suspended'));
    });
  }

  function handleWarn() {
    if (!warnMessage.trim()) return;
    startTransition(async () => {
      const res = await warnUserAction({ userId, message: warnMessage });
      setResult(res.error ?? 'Warning sent');
      setShowWarn(false);
      setWarnMessage('');
    });
  }

  function handleImpersonate() {
    if (!confirm('View as this user? You will be in read-only mode.')) return;
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
        setResult('Failed to start impersonation session');
      }
    });
  }

  function handleHoldRelease() {
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
    startTransition(async () => {
      const res = await resetPasswordAction({ userId });
      setResult(res.error ?? 'Password reset initiated');
    });
  }

  function handleBandOverride() {
    if (!bandReason.trim()) return;
    startTransition(async () => {
      const res = await overridePerformanceBandAction({ userId, newBand, reason: bandReason });
      setResult(res.error ?? `Performance band set to ${newBand}`);
      setShowBandOverride(false);
      setBandReason('');
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdateUser && (
        <button onClick={handleSuspendToggle} disabled={pending}
          className={`rounded px-3 py-1.5 text-xs text-white disabled:opacity-50 ${isBanned ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
          {isBanned ? 'Unsuspend' : 'Suspend'}
        </button>
      )}

      {canUpdateUser && (showWarn ? (
        <div className="flex items-center gap-1">
          <input value={warnMessage} onChange={(e) => setWarnMessage(e.target.value)}
            placeholder="Warning message..." className="w-48 rounded border px-2 py-1 text-xs" />
          <button onClick={handleWarn} disabled={pending}
            className="rounded bg-yellow-500 px-2 py-1 text-xs text-white disabled:opacity-50">Send</button>
          <button onClick={() => setShowWarn(false)} className="text-xs text-gray-500">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowWarn(true)} disabled={pending}
          className="rounded bg-yellow-500 px-3 py-1.5 text-xs text-white hover:bg-yellow-600 disabled:opacity-50">Warn</button>
      ))}

      {canUpdateSeller && isSeller && (
        <button onClick={handleHoldRelease} disabled={pending}
          className={`rounded px-3 py-1.5 text-xs text-white disabled:opacity-50 ${payoutsEnabled ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}>
          {payoutsEnabled ? 'Hold payouts' : 'Release payouts'}
        </button>
      )}

      {canUpdateUser && (
        <button onClick={handleResetPassword} disabled={pending}
          className="rounded bg-gray-600 px-3 py-1.5 text-xs text-white hover:bg-gray-700 disabled:opacity-50">
          Reset password
        </button>
      )}

      {canUpdateSeller && isSeller && (showBandOverride ? (
        <div className="flex items-center gap-1">
          <select value={newBand} onChange={(e) => setNewBand(e.target.value as typeof BANDS[number])}
            className="rounded border px-2 py-1 text-xs">
            {BANDS.map((b) => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}
          </select>
          <input value={bandReason} onChange={(e) => setBandReason(e.target.value)}
            placeholder="Reason..." className="w-32 rounded border px-2 py-1 text-xs" />
          <button onClick={handleBandOverride} disabled={pending}
            className="rounded bg-purple-600 px-2 py-1 text-xs text-white disabled:opacity-50">Apply</button>
          <button onClick={() => setShowBandOverride(false)} className="text-xs text-gray-500">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowBandOverride(true)} disabled={pending}
          className="rounded bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700 disabled:opacity-50">
          Override band
        </button>
      ))}

      {canImpersonate && (
        <button onClick={handleImpersonate} disabled={pending}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
          View as user
        </button>
      )}

      {result && <span className="text-xs text-gray-500">{result}</span>}
    </div>
  );
}
