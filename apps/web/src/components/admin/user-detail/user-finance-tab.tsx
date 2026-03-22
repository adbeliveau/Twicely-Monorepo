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
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function UserFinanceTab({ balance, payouts, ledgerEntries }: UserFinanceTabProps) {
  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available for payout</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{fmt(balance?.availableCents ?? 0)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{fmt(balance?.pendingCents ?? 0)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Reserved</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{fmt(balance?.reservedCents ?? 0)}</p>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">Recent Payouts</h3>
        </div>
        <div className="p-6">
          {payouts.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No payouts</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                          p.status === 'FAILED' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>{p.status}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{fmt(p.amountCents)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">Recent Ledger Entries</h3>
        </div>
        <div className="p-6">
          {ledgerEntries.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No ledger entries</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {ledgerEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{e.type}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{fmt(e.amountCents)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">{e.status}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
