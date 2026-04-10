'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { Copy, Check, Users, TrendingUp, Banknote } from 'lucide-react';
import { formatCentsToDollars } from '@twicely/finance/format';
import { AffiliateCommissionTable } from './affiliate-commission-table';
import type { AffiliateStats, CommissionRow } from '@/lib/queries/affiliate';

interface AffiliateDashboardProps {
  referralCode: string;
  status: string;
  tier: string;
  commissionRateBps: number;
  pendingBalanceCents: number;
  availableBalanceCents: number;
  totalEarnedCents: number;
  totalPaidCents: number;
  stats: AffiliateStats;
  recentCommissions: CommissionRow[];
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  SUSPENDED: 'destructive',
  BANNED: 'destructive',
  PENDING: 'secondary',
};

function getNextPayoutDate(): string {
  const now = new Date();
  const year = now.getUTCDate() >= 15 ? (now.getUTCMonth() === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()) : now.getUTCFullYear();
  const month = now.getUTCDate() >= 15 ? (now.getUTCMonth() + 1) % 12 : now.getUTCMonth();
  return new Date(Date.UTC(year, month, 15)).toLocaleDateString();
}

export function AffiliateDashboard({
  referralCode, status, tier, commissionRateBps,
  pendingBalanceCents, availableBalanceCents, totalEarnedCents, totalPaidCents,
  stats, recentCommissions,
}: AffiliateDashboardProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';
    await navigator.clipboard.writeText(`${baseUrl}?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header & Referral Link */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Affiliate Overview
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{tier.toLowerCase()}</Badge>
              <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>
            </div>
          </div>
          <CardDescription>
            {commissionRateBps / 100}% commission on subscription revenue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm">
              twicely.co?ref={referralCode}
            </code>
            <Button variant="outline" size="sm" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatsCard title="This Month" icon={<TrendingUp className="h-4 w-4" />} data={stats.thisMonth} />
        <StatsCard title="All Time" icon={<TrendingUp className="h-4 w-4" />} data={stats.allTime} />
      </div>

      {/* Balances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-5 w-5" />
            Balances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <BalanceItem label="Pending" value={formatCentsToDollars(pendingBalanceCents)} />
            <BalanceItem label="Available" value={formatCentsToDollars(availableBalanceCents)} />
            <BalanceItem label="Total Earned" value={formatCentsToDollars(totalEarnedCents)} />
            <BalanceItem label="Total Paid" value={formatCentsToDollars(totalPaidCents)} />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Next payout: {getNextPayoutDate()} — Payouts processed monthly on the 15th
            </p>
            <Button variant="outline" size="sm" disabled title="Payouts are processed monthly on the 15th">
              Request payout
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Commissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Commissions</CardTitle>
        </CardHeader>
        <CardContent>
          <AffiliateCommissionTable commissions={recentCommissions} />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/my/selling/affiliate/referrals">View Referred Users</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/my/selling/affiliate/payouts">View Payouts</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/my/selling/promotions">Promo Codes</Link>
        </Button>
      </div>
    </div>
  );
}

function StatsCard({ title, icon, data }: {
  title: string;
  icon: React.ReactNode;
  data: AffiliateStats['thisMonth'];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground">Clicks</p><p className="font-medium">{data.clicks.toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Signups</p><p className="font-medium">{data.signups.toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Conversions</p><p className="font-medium">{data.conversions.toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Conv. Rate</p><p className="font-medium">{data.conversionRate}%</p></div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Earnings</p>
            <p className="text-lg font-semibold">{formatCentsToDollars(data.earningsCents)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BalanceItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
