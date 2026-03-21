interface Balance {
  pendingCents: number;
  availableCents: number;
  reservedCents: number;
}

interface PayoutRow {
  id: string;
  status: string;
  amountCents: number;
  createdAt: Date;
}

interface LedgerRow {
  id: string;
  type: string;
  amountCents: number;
  status: string;
  createdAt: Date;
}

interface UserFinanceTabProps {
  balance: Balance | null;
  payouts: PayoutRow[];
  ledgerEntries: LedgerRow[];
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function UserFinanceTab({ balance, payouts, ledgerEntries }: UserFinanceTabProps) {
  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Earnings</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500">Available for payout</p>
            <p className="text-lg font-semibold text-gray-900">{fmt(balance?.availableCents ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-lg font-semibold text-gray-900">{fmt(balance?.pendingCents ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Reserved</p>
            <p className="text-lg font-semibold text-gray-900">{fmt(balance?.reservedCents ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Recent Payouts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary/5 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-primary/70">Status</th>
                <th className="px-3 py-2 font-medium text-primary/70">Amount</th>
                <th className="px-3 py-2 font-medium text-primary/70">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{p.status}</span>
                  </td>
                  <td className="px-3 py-2">{fmt(p.amountCents)}</td>
                  <td className="px-3 py-2 text-gray-500">{p.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">No payouts</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Recent Ledger Entries</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary/5 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-primary/70">Type</th>
                <th className="px-3 py-2 font-medium text-primary/70">Amount</th>
                <th className="px-3 py-2 font-medium text-primary/70">Status</th>
                <th className="px-3 py-2 font-medium text-primary/70">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ledgerEntries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{e.type}</td>
                  <td className="px-3 py-2">{fmt(e.amountCents)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{e.status}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{e.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
              {ledgerEntries.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">No ledger entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
