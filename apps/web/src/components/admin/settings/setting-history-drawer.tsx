'use client';

import { useState, useTransition } from 'react';

interface HistoryEntry {
  id: string;
  previousValue: unknown;
  newValue: unknown;
  changedByStaffId: string;
  reason: string | null;
  createdAt: Date | string;
}

interface Props {
  settingId: string;
  settingKey: string;
}

function truncate(val: unknown, maxLen: number = 60): string {
  const s = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

export function SettingHistoryDrawer({ settingId, settingKey }: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    if (!loaded) {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/hub/settings/history?settingId=${encodeURIComponent(settingId)}`);
          if (res.ok) {
            const data = await res.json() as { history: HistoryEntry[] };
            setHistory(data.history ?? []);
          }
        } catch {
          // silently fail — show empty state
        }
        setLoaded(true);
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-200"
      >
        History
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div
            className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Setting History</p>
                <code className="text-xs font-mono text-gray-500">{settingKey}</code>
              </div>
              <button type="button" onClick={() => setOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="px-4 py-4">
              {isPending && (
                <p className="text-sm text-gray-400">Loading history...</p>
              )}
              {!isPending && loaded && history.length === 0 && (
                <p className="text-sm text-gray-400">No history recorded yet.</p>
              )}
              {!isPending && history.length > 0 && (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">
                          {truncate(entry.previousValue)}
                        </span>
                        <span>→</span>
                        <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-700">
                          {truncate(entry.newValue)}
                        </span>
                      </div>
                      {entry.reason && (
                        <p className="mt-1 text-xs text-gray-500 italic">{entry.reason}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
