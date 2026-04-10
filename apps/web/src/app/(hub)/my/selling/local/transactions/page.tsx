import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerLocalTransactions } from '@/lib/queries/local-seller-dashboard';
import { STATUS_LABELS, STATUS_VARIANT } from '@/components/local/local-meetup-status';
import { Badge } from '@twicely/ui/badge';
import { Card, CardContent } from '@twicely/ui/card';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Local Transactions | Twicely',
  robots: 'noindex',
};

type StatusFilter = 'all' | 'active' | 'completed' | 'canceled' | 'no_show';
const VALID_FILTERS: StatusFilter[] = ['all', 'active', 'completed', 'canceled', 'no_show'];

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LocalTransactionsPage({ searchParams }: Props) {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/local/transactions');
  }

  if (!session.isSeller && !session.delegationId) {
    redirect('/my');
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  const params = await searchParams;
  const rawFilter = typeof params.filter === 'string' ? params.filter : 'all';
  const filter: StatusFilter = VALID_FILTERS.includes(rawFilter as StatusFilter)
    ? (rawFilter as StatusFilter)
    : 'all';

  const transactions = await getSellerLocalTransactions(userId, filter);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/my/selling/local"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Local Pickup
        </Link>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-1">All your local pickup transactions</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b pb-2">
        {(['all', 'active', 'completed', 'canceled', 'no_show'] as const).map((f) => (
          <Link
            key={f}
            href={`/my/selling/local/transactions${f === 'all' ? '' : `?filter=${f}`}`}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {f === 'no_show' ? 'No Show' : f.charAt(0).toUpperCase() + f.slice(1)}
          </Link>
        ))}
      </div>

      {/* Transaction list */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No transactions found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <Link
              key={tx.id}
              href={`/my/selling/orders/${tx.orderId}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{tx.listingTitle ?? `Order #${tx.orderId.slice(0, 8)}`}</p>
                  <Badge variant={STATUS_VARIANT[tx.status] ?? 'secondary'} className="text-xs">
                    {STATUS_LABELS[tx.status] ?? tx.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {tx.buyerName && <span>Buyer: {tx.buyerName}</span>}
                  {tx.locationName && <span>@ {tx.locationName}</span>}
                  <span>{tx.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">${(tx.amountCents / 100).toFixed(2)}</p>
                {tx.scheduledAt && (
                  <p className="text-xs text-muted-foreground">
                    {tx.scheduledAt.toLocaleDateString()}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
