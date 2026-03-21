'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { Copy, Check, Users } from 'lucide-react';

interface AffiliateStatusCardProps {
  referralCode: string;
  status: string;
  commissionRateBps: number;
  cookieDurationDays: number;
  commissionDurationMonths: number;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  SUSPENDED: 'destructive',
  BANNED: 'destructive',
  PENDING: 'secondary',
};

export function AffiliateStatusCard({
  referralCode,
  status,
  commissionRateBps,
  cookieDurationDays,
  commissionDurationMonths,
}: AffiliateStatusCardProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(`twicely.co/ref/${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Affiliate Program
          </CardTitle>
          <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>
        </div>
        <CardDescription>Your community affiliate account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Referral link</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm">
              twicely.co/ref/{referralCode}
            </code>
            <Button variant="outline" size="sm" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Commission</p>
            <p className="font-medium">{commissionRateBps / 100}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cookie</p>
            <p className="font-medium">{cookieDurationDays} days</p>
          </div>
          <div>
            <p className="text-muted-foreground">Duration</p>
            <p className="font-medium">{commissionDurationMonths} months</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Full dashboard with referral stats, commissions, and payouts coming soon.
        </p>
      </CardContent>
    </Card>
  );
}
