'use client';

import { useState, useTransition } from 'react';
import { updateSettingAction } from '@/lib/actions/admin-settings';
import type { SettingRow } from '@/lib/queries/admin-settings';

interface Props {
  settings: SettingRow[];
}

interface CardDef {
  title: string;
  keys: string[];
  description: string;
}

const CARDS: CardDef[] = [
  {
    title: 'Claim Windows',
    description: 'Time limits for buyer protection claims',
    keys: ['protection.standardClaimWindowDays', 'protection.counterfeitClaimWindowDays'],
  },
  {
    title: 'Response & Escalation',
    description: 'Seller response windows and auto-approval rules',
    keys: [
      'protection.sellerResponseHours',
      'protection.autoApproveOnNonResponse',
      'returns.sellerResponseDays',
    ],
  },
  {
    title: 'Auto-Close Conditions',
    description: 'Rules for automatically closing return requests',
    keys: ['returns.autoApproveUnderCents', 'returns.maxReturnsPerBuyerPerMonth'],
  },
  {
    title: 'Fees & Limits',
    description: 'Fee amounts and maximum claim limits',
    keys: [
      'protection.maxClaimAmountCents',
      'protection.maxRestockingFeePercent',
      'protection.chargebackFeeCents',
      'payments.disputeSellerFeeCents',
      'payments.waiveFirstDisputeFee',
    ],
  },
];

function formatKey(key: string): string {
  return key.split('.').pop()?.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()) ?? key;
}

function SettingRow({ row, onSave }: {
  row: SettingRow;
  onSave: (id: string, value: unknown, reason: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [rawValue, setRawValue] = useState(String(row.value));
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const handleSave = () => {
    if (!reason.trim()) { setMsg('Reason required'); return; }
    let parsed: unknown = rawValue;
    if (row.type === 'boolean') parsed = rawValue === 'true';
    else if (row.type === 'number' || row.type === 'cents') parsed = Number(rawValue);
    startTransition(async () => {
      await onSave(row.id, parsed, reason.trim());
      setEditing(false);
      setMsg(null);
    });
  };

  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0 gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700">{formatKey(row.key)}</p>
        {row.description && <p className="text-xs text-gray-400 mt-0.5">{row.description}</p>}
        <p className="text-xs font-mono text-gray-400 mt-0.5">{row.key}</p>
      </div>
      <div className="shrink-0 text-right">
        {!editing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{String(row.value)}</span>
            <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
              Edit
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1 items-end">
            <input
              type="text"
              value={rawValue}
              onChange={(e) => setRawValue(e.target.value)}
              className="border rounded px-2 py-1 text-xs w-32 text-right"
            />
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required)"
              className="border rounded px-2 py-1 text-xs w-40"
            />
            {msg && <p className="text-xs text-red-600">{msg}</p>}
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                disabled={pending}
                className="rounded bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => { setEditing(false); setMsg(null); }} className="text-xs text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DisputeRulesForm({ settings }: Props) {
  const settingMap = new Map(settings.map((s) => [s.key, s]));

  const handleSave = async (id: string, value: unknown, reason: string) => {
    await updateSettingAction({ settingId: id, value, reason });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {CARDS.map((card) => {
        const cardSettings = card.keys
          .map((k) => settingMap.get(k))
          .filter((s): s is SettingRow => s !== undefined);

        return (
          <div key={card.title} className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-primary mb-0.5">{card.title}</h3>
            <p className="text-xs text-gray-400 mb-3">{card.description}</p>
            {cardSettings.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No settings configured yet</p>
            ) : (
              cardSettings.map((s) => (
                <SettingRow key={s.id} row={s} onSave={handleSave} />
              ))
            )}
          </div>
        );
      })}

      {/* Escalation thresholds — read-only */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-primary mb-0.5">Escalation Thresholds</h3>
        <p className="text-xs text-gray-400 mb-3">Read-only summary of current escalation configuration</p>
        {settings.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No settings seeded yet</p>
        ) : (
          <dl className="space-y-1">
            {settings.map((s) => (
              <div key={s.id} className="flex justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                <dt className="text-gray-500 font-mono">{s.key}</dt>
                <dd className="text-gray-900 font-medium">{String(s.value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
