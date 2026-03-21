'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import { Button } from '@twicely/ui/button';
import { Badge } from '@twicely/ui/badge';
import { formatCentsToDollars, getLedgerTypeLabel } from '@twicely/finance/format';
import { getTransactionHistoryAction } from '@/lib/actions/finance-center';
import type { TransactionListResult, TransactionRow } from '@/lib/queries/finance-center';

type TypeGroup = 'ALL' | 'SALES' | 'FEES' | 'PAYOUTS' | 'REFUNDS' | 'OTHER';

interface TransactionTableProps {
  initialData: TransactionListResult;
  showUpgradeBanner?: boolean;
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  POSTED: 'default',
  PENDING: 'secondary',
  REVERSED: 'outline',
};

function AmountCell({ cents }: { cents: number }) {
  const isCredit = cents > 0;
  return (
    <span className={isCredit ? 'text-green-600 font-medium' : 'text-red-600'}>
      {cents >= 0 ? '+' : ''}{formatCentsToDollars(cents)}
    </span>
  );
}

function TransactionRow({ tx }: { tx: TransactionRow }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/40 transition-colors">
      <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
        {new Date(tx.createdAt).toLocaleDateString('en-US')}
      </td>
      <td className="py-3 px-4 text-sm">{getLedgerTypeLabel(tx.type)}</td>
      <td className="py-3 px-4 text-sm text-right">
        <AmountCell cents={tx.amountCents} />
      </td>
      <td className="py-3 px-4">
        <Badge variant={STATUS_VARIANTS[tx.status] ?? 'secondary'}>
          {tx.status.toLowerCase()}
        </Badge>
      </td>
      <td className="py-3 px-4 text-sm">
        {tx.orderId ? (
          <Link href={`/my/selling/orders/${tx.orderId}`} className="text-primary underline text-xs">
            View order
          </Link>
        ) : null}
      </td>
    </tr>
  );
}

export function TransactionTable({ initialData, showUpgradeBanner }: TransactionTableProps) {
  const [data, setData] = useState<TransactionListResult>(initialData);
  const [typeGroup, setTypeGroup] = useState<TypeGroup>('ALL');
  const [isPending, startTransition] = useTransition();

  function handleGroupChange(group: string) {
    const g = group as TypeGroup;
    setTypeGroup(g);
    startTransition(async () => {
      const result = await getTransactionHistoryAction(1, 20, undefined, g === 'ALL' ? undefined : g);
      if (result.success) setData(result.data);
    });
  }

  function handlePageChange(page: number) {
    startTransition(async () => {
      const result = await getTransactionHistoryAction(
        page,
        data.pageSize,
        undefined,
        typeGroup === 'ALL' ? undefined : typeGroup,
      );
      if (result.success) setData(result.data);
    });
  }

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="space-y-4">
      {showUpgradeBanner && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          You are viewing the last 30 days.{' '}
          <Link href="/my/selling/subscription" className="font-medium underline">
            Upgrade to Finance Pro
          </Link>{' '}
          for 2 years of history.
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by:</span>
        <Select value={typeGroup} onValueChange={handleGroupChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="SALES">Sales</SelectItem>
            <SelectItem value="FEES">Fees</SelectItem>
            <SelectItem value="PAYOUTS">Payouts</SelectItem>
            <SelectItem value="REFUNDS">Refunds</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {data.total} transaction{data.total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {data.transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No transactions found for this filter.
        </p>
      ) : (
        <div className={`rounded-md border overflow-x-auto ${isPending ? 'opacity-60' : ''}`}>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <th className="py-2 px-4">Date</th>
                <th className="py-2 px-4">Type</th>
                <th className="py-2 px-4 text-right">Amount</th>
                <th className="py-2 px-4">Status</th>
                <th className="py-2 px-4">Order</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(data.page - 1)}
            disabled={data.page <= 1 || isPending}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(data.page + 1)}
            disabled={data.page >= totalPages || isPending}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
