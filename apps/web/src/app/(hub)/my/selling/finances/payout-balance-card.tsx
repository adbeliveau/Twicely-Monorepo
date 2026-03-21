'use client';

import { Card, CardContent } from '@twicely/ui/card';
import { formatBalanceAmount } from '@twicely/stripe/payouts';

interface BalanceAmount {
  amount: number;
  currency: string;
}

interface BalanceData {
  available: BalanceAmount[];
  pending: BalanceAmount[];
  instantAvailable?: BalanceAmount[];
}

interface PayoutBalanceCardProps {
  balance: BalanceData | null | undefined;
}

// v3.2 Payout UX Language: Standard disclosure per Canonical §3.3
const STRIPE_DISCLOSURE = 'Funds are processed and paid out through Stripe. Twicely displays payout status and transaction activity.';

export function PayoutBalanceCard({ balance }: PayoutBalanceCardProps) {
  if (!balance) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PayoutCard title="Available for payout" amount={null} description="Ready for payout" />
          <PayoutCard title="Pending payout" amount={null} description="Processing (2-7 days)" />
          <PayoutCard title="Instant payout available" amount={null} description="For instant payouts" />
        </div>
        <p className="text-xs text-muted-foreground">{STRIPE_DISCLOSURE}</p>
      </div>
    );
  }

  const availableUsd = balance.available.find((b) => b.currency === 'usd');
  const pendingUsd = balance.pending.find((b) => b.currency === 'usd');
  const instantUsd = balance.instantAvailable?.find((b) => b.currency === 'usd');

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PayoutCard
          title="Available for payout"
          amount={availableUsd ? formatBalanceAmount(availableUsd.amount, availableUsd.currency) : '$0.00'}
          description="Ready for payout"
          highlight
        />
        <PayoutCard
          title="Pending payout"
          amount={pendingUsd ? formatBalanceAmount(pendingUsd.amount, pendingUsd.currency) : '$0.00'}
          description="Processing (2-7 days)"
        />
        {instantUsd !== undefined && (
          <PayoutCard
            title="Instant payout available"
            amount={formatBalanceAmount(instantUsd.amount, instantUsd.currency)}
            description="For instant payouts"
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{STRIPE_DISCLOSURE}</p>
    </div>
  );
}

function PayoutCard({
  title,
  amount,
  description,
  highlight,
}: {
  title: string;
  amount: string | null;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary' : ''}>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className={`text-2xl font-bold mt-1 ${amount === null ? 'text-muted-foreground' : ''}`}>
          {amount ?? '---'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
