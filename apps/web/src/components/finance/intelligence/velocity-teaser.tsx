/**
 * Revenue Velocity teaser — FREE tier.
 * Shows a blurred/locked preview nudging upgrade to Finance Pro.
 * No data gate.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import Link from 'next/link';
import { Lock } from 'lucide-react';

interface VelocityTeaserProps {
  orderCountThisMonth: number;
}

export function VelocityTeaser({ orderCountThisMonth }: VelocityTeaserProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Lock className="h-5 w-5 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">Revenue Velocity</p>
          <Link
            href="/my/selling/subscription"
            className="text-xs text-primary underline underline-offset-2"
          >
            Upgrade to Finance Pro
          </Link>
        </div>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-muted-foreground">Revenue Velocity</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-muted-foreground">
          {orderCountThisMonth} orders
        </p>
        <p className="text-sm text-muted-foreground mt-1">projected month-end: —</p>
      </CardContent>
    </Card>
  );
}
