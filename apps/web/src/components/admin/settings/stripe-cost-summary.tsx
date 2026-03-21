interface StripeFeeSetting {
  label: string;
  value: unknown;
  type: 'cents' | 'bps' | 'other';
}

interface Props {
  settings: StripeFeeSetting[];
  connectionStatus: 'connected' | 'not_configured' | 'test_mode';
  recentEvents: Array<{
    id: string;
    action: string;
    actorId: string | null;
    severity: string;
    createdAt: Date | string;
  }>;
}

function formatFee(value: unknown, type: 'cents' | 'bps' | 'other'): string {
  const n = Number(value);
  if (type === 'cents') return `$${(n / 100).toFixed(2)}`;
  if (type === 'bps') return `${(n / 100).toFixed(2)}%`;
  return String(value ?? '—');
}

const STATUS_STYLES: Record<string, string> = {
  connected: 'bg-green-100 text-green-800',
  not_configured: 'bg-red-100 text-red-800',
  test_mode: 'bg-yellow-100 text-yellow-800',
};
const STATUS_LABELS: Record<string, string> = {
  connected: 'Live — Connected',
  not_configured: 'Not Configured',
  test_mode: 'Test Mode',
};

export function StripeCostSummary({ settings, connectionStatus, recentEvents }: Props) {
  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <span className="text-sm font-medium text-gray-700">Connection Status:</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[connectionStatus] ?? 'bg-gray-100 text-gray-700'}`}>
          {STATUS_LABELS[connectionStatus] ?? connectionStatus}
        </span>
      </div>

      {/* Fee Cost Summary */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Stripe Fee Schedule</h3>
          <p className="text-xs text-gray-400">Platform costs absorbed by Twicely — not charged to sellers</p>
        </div>
        <div className="divide-y divide-gray-100">
          {settings.map((s) => (
            <div key={s.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-700">{s.label}</span>
              <span className="text-sm font-semibold text-gray-900">{formatFee(s.value, s.type)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Webhook Events */}
      {recentEvents.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Audit Events</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentEvents.map((evt) => (
              <div key={evt.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-xs font-mono text-gray-800">{evt.action}</span>
                  {evt.actorId && (
                    <span className="ml-2 text-xs text-gray-400">by {evt.actorId}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(evt.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
