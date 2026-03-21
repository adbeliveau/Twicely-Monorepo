import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getTransactionHistoryAction } from '@/lib/actions/finance-center';
import { getFinanceTier } from '@/lib/queries/finance-center';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { TransactionTable } from '@/components/finance/transaction-table';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Transactions | Twicely',
  robots: 'noindex',
};

export default async function TransactionsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/finances/transactions');
  }

  const [result, financeTier] = await Promise.all([
    getTransactionHistoryAction(1, 20),
    getFinanceTier(session.userId),
  ]);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb */}
      <div>
        <Link
          href="/my/selling/finances"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Finances
        </Link>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground text-sm">
          {financeTier === 'FREE' ? 'Last 30 days of transaction history' : 'Full transaction history'}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionTable
            initialData={result.data}
            showUpgradeBanner={financeTier === 'FREE'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
