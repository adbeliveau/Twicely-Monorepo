/**
 * Trial Status — Shows remaining trial days
 *
 * For users currently in a trial period. Shows days remaining
 * with a progress indicator and CTA to subscribe.
 */

import Link from 'next/link';
import { Clock } from 'lucide-react';
import { TRIAL_PERIOD_DAYS, getTrialDaysRemaining } from '@twicely/stripe/trials';
import { Button } from '@twicely/ui/button';

interface TrialStatusProps {
  trialEnd: Date;
  productName: string;
  subscribeUrl?: string;
}

export function TrialStatus({
  trialEnd,
  productName,
  subscribeUrl = '/pricing',
}: TrialStatusProps) {
  const daysRemaining = getTrialDaysRemaining(trialEnd);
  const progress = Math.max(0, Math.min(100, ((TRIAL_PERIOD_DAYS - daysRemaining) / TRIAL_PERIOD_DAYS) * 100));

  // Don't show if trial has expired
  if (daysRemaining < 0) {
    return null;
  }

  const isUrgent = daysRemaining <= 3;

  return (
    <div className={`rounded-lg border p-4 ${isUrgent ? 'border-yellow-300 bg-yellow-50' : 'border-muted bg-card'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Clock className={`h-5 w-5 ${isUrgent ? 'text-yellow-600' : 'text-muted-foreground'}`} />
          <div>
            <p className="font-medium">
              {productName} Trial: {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
            </p>
            <p className="text-sm text-muted-foreground">
              Ends {trialEnd.toLocaleDateString()}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant={isUrgent ? 'default' : 'outline'}>
          <Link href={subscribeUrl}>Subscribe to Keep Features</Link>
        </Button>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
