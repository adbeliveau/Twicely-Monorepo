'use client';

import { useState, useTransition } from 'react';
import { updatePlatformSetting } from '@/lib/actions/admin-settings';

interface PayoutSettingsCardsProps {
  escrowHoldHours: number;
  escrowSettingId: string | null;
  minimumPayoutCents: number;
  payoutSettingId: string | null;
  instantPayoutFeeCents: number;
  instantFeeSettingId: string | null;
  canEdit: boolean;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PayoutSettingsCards({
  escrowHoldHours, escrowSettingId,
  minimumPayoutCents, payoutSettingId,
  instantPayoutFeeCents, instantFeeSettingId,
  canEdit,
}: PayoutSettingsCardsProps) {
  const [editing, setEditing] = useState(false);
  const [escrow, setEscrow] = useState(escrowHoldHours);
  const [minPayout, setMinPayout] = useState(minimumPayoutCents);
  const [instantFee, setInstantFee] = useState(instantPayoutFeeCents);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setEscrow(escrowHoldHours);
    setMinPayout(minimumPayoutCents);
    setInstantFee(instantPayoutFeeCents);
    setEditing(true);
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      if (escrowSettingId && escrow !== escrowHoldHours) {
        await updatePlatformSetting(escrowSettingId, escrow);
      }
      if (payoutSettingId && minPayout !== minimumPayoutCents) {
        await updatePlatformSetting(payoutSettingId, minPayout);
      }
      if (instantFeeSettingId && instantFee !== instantPayoutFeeCents) {
        await updatePlatformSetting(instantFeeSettingId, instantFee);
      }
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const inputCls = 'w-28 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Payout Settings</h2>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">Saved!</span>}
          {canEdit && !editing && (
            <button onClick={startEdit}
              className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
              Edit
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Escrow hold after delivery</p>
          {editing ? (
            <div className="mt-1 flex items-center gap-1">
              <input type="number" min={1} className={inputCls} value={escrow}
                onChange={(e) => setEscrow(parseInt(e.target.value) || 72)} />
              <span className="text-sm text-gray-400">hours</span>
            </div>
          ) : (
            <p className="mt-1 text-lg font-semibold text-gray-900">{escrowHoldHours}h</p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Minimum payout</p>
          {editing ? (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-sm text-gray-400">$</span>
              <input type="number" step="0.01" min={0} className={inputCls}
                value={(minPayout / 100).toFixed(2)}
                onChange={(e) => setMinPayout(Math.round(parseFloat(e.target.value || '0') * 100))} />
            </div>
          ) : (
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatCents(minimumPayoutCents)}</p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Instant payout fee</p>
          {editing ? (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-sm text-gray-400">$</span>
              <input type="number" step="0.01" min={0} className={inputCls}
                value={(instantFee / 100).toFixed(2)}
                onChange={(e) => setInstantFee(Math.round(parseFloat(e.target.value || '0') * 100))} />
            </div>
          ) : (
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatCents(instantPayoutFeeCents)}</p>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={() => setEditing(false)} disabled={isPending}
            className="rounded bg-gray-100 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
