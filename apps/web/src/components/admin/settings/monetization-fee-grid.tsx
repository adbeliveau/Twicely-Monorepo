'use client';

import { useState, useTransition } from 'react';
import { updatePlatformSetting } from '@/lib/actions/admin-settings';
import type { TfBracket } from '@/lib/queries/admin-monetization';

interface MonetizationFeeGridProps {
  brackets: TfBracket[];
  minimumTfCents: number;
  minimumTfSettingId: string | null;
  canEdit: boolean;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

interface EditState {
  rates: number[];           // bps per bracket
  ceilings: number[];        // cents per bracket (-1 = unlimited)
  minimumTfCents: number;
}

function buildEditState(brackets: TfBracket[], minTf: number): EditState {
  return {
    rates: brackets.map((b) => b.rateBps),
    ceilings: brackets.map((b) => b.maxCents === null ? -1 : b.maxCents),
    minimumTfCents: minTf,
  };
}

export function MonetizationFeeGrid({
  brackets, minimumTfCents, minimumTfSettingId,
  canEdit,
}: MonetizationFeeGridProps) {
  const [editing, setEditing] = useState(false);
  const [es, setEs] = useState<EditState>(() => buildEditState(brackets, minimumTfCents));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setEs(buildEditState(brackets, minimumTfCents));
    setEditing(true);
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      for (const [i, b] of brackets.entries()) {
        const newRate = es.rates[i] ?? b.rateBps;
        const newCeiling = es.ceilings[i] ?? (b.maxCents === null ? -1 : b.maxCents);
        if (b.rateSettingId && newRate !== b.rateBps) {
          await updatePlatformSetting(b.rateSettingId, newRate);
        }
        if (b.maxCentsSettingId && newCeiling !== (b.maxCents === null ? -1 : b.maxCents)) {
          await updatePlatformSetting(b.maxCentsSettingId, newCeiling);
        }
      }
      if (minimumTfSettingId && es.minimumTfCents !== minimumTfCents) {
        await updatePlatformSetting(minimumTfSettingId, es.minimumTfCents);
      }
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const inputCls = 'w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Transaction Fee Brackets</h3>
            <p className="text-xs text-gray-500">Progressive marginal rates (like income tax brackets)</p>
          </div>
          {canEdit && !editing && (
            <button onClick={startEdit}
              className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
              Edit Brackets
            </button>
          )}
          {saved && <span className="text-xs text-green-600">Saved!</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-2">Bracket</th>
                <th className="px-4 py-2">Monthly GMV Ceiling</th>
                <th className="px-4 py-2">Marginal TF Rate</th>
              </tr>
            </thead>
            <tbody>
              {brackets.map((b, i) => (
                <tr key={b.bracket} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-2 text-gray-600">{b.bracket}</td>
                  <td className="px-4 py-2 text-gray-900">
                    {editing && i < 7 ? (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">$</span>
                        <input type="number" className={inputCls} value={(es.ceilings[i] ?? 0) / 100}
                          onChange={(e) => {
                            const next = [...es.ceilings];
                            next[i] = Math.round(parseFloat(e.target.value || '0') * 100);
                            setEs({ ...es, ceilings: next });
                          }} />
                      </div>
                    ) : (
                      <>
                        {formatCents(b.minCents)}{' \u2013 '}
                        {b.maxCents !== null ? formatCents(b.maxCents) : '\u221E'}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <input type="number" step="0.1" className={inputCls}
                          value={((es.rates[i] ?? 0) / 100).toFixed(1)}
                          onChange={(e) => {
                            const next = [...es.rates];
                            next[i] = Math.round(parseFloat(e.target.value || '0') * 100);
                            setEs({ ...es, rates: next });
                          }} />
                        <span className="text-gray-400">%</span>
                      </div>
                    ) : formatBps(b.rateBps)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editing && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
            <button onClick={() => setEditing(false)} disabled={isPending}
              className="rounded bg-gray-100 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200">
              Cancel
            </button>
            <button onClick={handleSave} disabled={isPending}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
              {isPending ? 'Saving...' : 'Save Brackets'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Minimum TF per order</p>
          {editing ? (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-gray-400">$</span>
              <input type="number" step="0.01" className={inputCls}
                value={(es.minimumTfCents / 100).toFixed(2)}
                onChange={(e) => setEs({ ...es, minimumTfCents: Math.round(parseFloat(e.target.value || '0') * 100) })} />
            </div>
          ) : (
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatCents(minimumTfCents)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
