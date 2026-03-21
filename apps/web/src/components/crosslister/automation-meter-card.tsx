'use client';

/**
 * AutomationMeterCard — displays automation action usage for the current month.
 * Shows a progress bar (green < 80%, yellow 80-95%, red > 95%).
 * Source: F6 install prompt §B.3.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import { ExternalLink } from 'lucide-react';

interface AutomationMeterCardProps {
  used: number;
  limit: number;
  remaining: number;
}

export function AutomationMeterCard({ used, limit, remaining }: AutomationMeterCardProps) {
  const usagePercent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  let indicatorColor: string;
  if (usagePercent >= 95) {
    indicatorColor = 'bg-destructive';
  } else if (usagePercent >= 80) {
    indicatorColor = 'bg-yellow-500';
  } else {
    indicatorColor = 'bg-green-500';
  }

  const showOveragePrompt = usagePercent >= 80;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Action Usage This Month</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span>
              {used.toLocaleString()} / {limit.toLocaleString()} actions used
            </span>
            <span className="text-muted-foreground">{remaining.toLocaleString()} remaining</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all ${indicatorColor}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Resets on the 1st of each month.</p>
        </div>

        {showOveragePrompt && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-2">
            <p className="text-muted-foreground">
              You&apos;re approaching your monthly action limit.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              asChild
            >
              <a href="mailto:support@twicely.co?subject=Automation%20Overage%20Actions">
                Contact support for additional actions
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
