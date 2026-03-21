'use client';

import { formatBalanceAmount, getPayoutStatusLabel, type PayoutStatus } from '@twicely/stripe/payouts';
import { cn } from '@twicely/utils';

interface PayoutItem {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  arrivalDate: Date;
  createdAt: Date;
  method: string;
  description: string | null;
}

interface PayoutHistoryTableProps {
  payouts: PayoutItem[];
  error: string | null;
}

export function PayoutHistoryTable({ payouts, error }: PayoutHistoryTableProps) {
  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Failed to load payout history: {error}
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No payouts yet</p>
        <p className="text-sm mt-1">
          When you make sales, payouts will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-3 font-medium">Date</th>
            <th className="pb-3 font-medium">Amount</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Arrival</th>
            <th className="pb-3 font-medium">Method</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => (
            <tr key={payout.id} className="border-b last:border-0">
              <td className="py-3">
                {new Date(payout.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </td>
              <td className="py-3 font-medium">
                {formatBalanceAmount(payout.amount, payout.currency)}
              </td>
              <td className="py-3">
                <StatusBadge status={payout.status} />
              </td>
              <td className="py-3 text-muted-foreground">
                {new Date(payout.arrivalDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </td>
              <td className="py-3 text-muted-foreground capitalize">{payout.method}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: PayoutStatus }) {
  const label = getPayoutStatusLabel(status);

  const colorClass = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    in_transit: 'bg-blue-100 text-blue-700',
    canceled: 'bg-gray-100 text-gray-700',
    failed: 'bg-red-100 text-red-700',
  }[status];

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colorClass)}>
      {label}
    </span>
  );
}
