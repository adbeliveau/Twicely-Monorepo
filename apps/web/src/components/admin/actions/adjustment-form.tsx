'use client';

import { useTransition, useState } from 'react';
import { createManualAdjustmentAction } from '@/lib/actions/admin-finance';

export function AdjustmentForm() {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    userId: '',
    type: 'MANUAL_CREDIT' as 'MANUAL_CREDIT' | 'MANUAL_DEBIT',
    amountCents: 0,
    reasonCode: 'GOODWILL_CREDIT' as string,
    reasonText: '',
  });

  function handleSubmit() {
    if (!form.userId || form.amountCents <= 0 || !form.reasonText) return;
    startTransition(async () => {
      const res = await createManualAdjustmentAction({
        userId: form.userId,
        type: form.type,
        amountCents: form.amountCents,
        reasonCode: form.reasonCode,
        reasonText: form.reasonText,
      });
      setResult(res.error ?? 'Adjustment created');
      if (!res.error) {
        setOpen(false);
        setForm({ userId: '', type: 'MANUAL_CREDIT', amountCents: 0, reasonCode: 'GOODWILL_CREDIT', reasonText: '' });
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
        New Adjustment
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">New Manual Adjustment</h3>
      <div className="grid gap-3 text-sm">
        <input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} placeholder="User ID" className="rounded border px-2 py-1.5" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'MANUAL_CREDIT' | 'MANUAL_DEBIT' })} className="rounded border px-2 py-1.5">
          <option value="MANUAL_CREDIT">Credit</option>
          <option value="MANUAL_DEBIT">Debit</option>
        </select>
        <input type="number" min="1" value={form.amountCents || ''} onChange={(e) => setForm({ ...form, amountCents: parseInt(e.target.value, 10) || 0 })} placeholder="Amount (cents)" className="rounded border px-2 py-1.5" />
        <select value={form.reasonCode} onChange={(e) => setForm({ ...form, reasonCode: e.target.value })} className="rounded border px-2 py-1.5">
          <option value="GOODWILL_CREDIT">Goodwill Credit</option>
          <option value="ERROR_CORRECTION">Error Correction</option>
          <option value="PROMOTIONAL">Promotional</option>
          <option value="OTHER">Other</option>
        </select>
        <input value={form.reasonText} onChange={(e) => setForm({ ...form, reasonText: e.target.value })} placeholder="Reason (required)" className="rounded border px-2 py-1.5" />
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={pending} className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white disabled:opacity-50">Submit</button>
          <button onClick={() => setOpen(false)} className="rounded border px-3 py-1.5 text-xs text-gray-600">Cancel</button>
        </div>
        {result && <p className="text-xs text-gray-500">{result}</p>}
      </div>
    </div>
  );
}
