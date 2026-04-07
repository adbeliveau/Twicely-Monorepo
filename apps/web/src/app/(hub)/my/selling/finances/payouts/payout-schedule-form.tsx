'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { RadioGroup, RadioGroupItem } from '@twicely/ui/radio-group';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { updatePayoutScheduleAction } from '@/lib/actions/payout-settings';

type PayoutInterval = 'manual' | 'daily' | 'weekly' | 'monthly';

interface PayoutSchedule {
  delayDays: number;
  interval: PayoutInterval;
  weeklyAnchor?: string;
}

interface PayoutScheduleFormProps {
  currentSchedule: PayoutSchedule | null;
  availableOptions: PayoutInterval[];
  /** Store tier - passed for future display but tier-gating is handled server-side */
  storeTier: string;
}

const INTERVAL_LABELS: Record<PayoutInterval, { label: string; description: string }> = {
  daily: {
    label: 'Daily',
    description: 'Receive payouts every business day',
  },
  weekly: {
    label: 'Weekly',
    description: 'Receive payouts once per week',
  },
  manual: {
    label: 'Manual',
    description: 'Manually initiate payouts when needed',
  },
  monthly: {
    label: 'Monthly',
    description: 'Receive payouts once per month',
  },
};

export function PayoutScheduleForm({
  currentSchedule,
  availableOptions,
  storeTier,
}: PayoutScheduleFormProps) {
  const router = useRouter();
  const [selectedInterval, setSelectedInterval] = useState<PayoutInterval>(
    currentSchedule?.interval ?? 'weekly'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    const result = await updatePayoutScheduleAction(selectedInterval);

    setIsSubmitting(false);

    if (result.success) {
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error ?? 'Failed to update payout schedule');
    }
  };

  const hasChanged = selectedInterval !== currentSchedule?.interval;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Payout schedule updated successfully
        </div>
      )}

      <RadioGroup
        value={selectedInterval}
        onValueChange={(v: string) => setSelectedInterval(v as PayoutInterval)}
        className="space-y-3"
      >
        {(['daily', 'weekly', 'monthly', 'manual'] as PayoutInterval[]).map((interval) => {
          const isAvailable = availableOptions.includes(interval);
          const { label, description } = INTERVAL_LABELS[interval];

          return (
            <div
              key={interval}
              className={`flex items-start space-x-3 rounded-lg border p-4 ${
                !isAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'
              } ${selectedInterval === interval ? 'border-primary bg-primary/5' : ''}`}
            >
              <RadioGroupItem
                value={interval}
                id={interval}
                disabled={!isAvailable}
                className="mt-0.5"
              />
              <Label htmlFor={interval} className="flex-1 cursor-pointer">
                <span className="font-medium">{label}</span>
                {!isAvailable && (
                  <span className="ml-2 text-xs text-muted-foreground">(Upgrade required)</span>
                )}
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
              </Label>
            </div>
          );
        })}
      </RadioGroup>

      <p className="text-sm text-muted-foreground">
        Your {storeTier} plan includes {availableOptions.length} payout option{availableOptions.length !== 1 ? 's' : ''}.
        {/* v3.2: Daily payouts available at POWER tier */}
        {['NONE', 'STARTER', 'PRO'].includes(storeTier) && ' Upgrade to Power for daily payouts.'}
      </p>

      {currentSchedule && (
        <div className="text-sm text-muted-foreground">
          <p>
            Current setting: <strong className="text-foreground">{INTERVAL_LABELS[currentSchedule.interval].label}</strong>
          </p>
          <p>Payout delay: {currentSchedule.delayDays} days after charge</p>
        </div>
      )}

      <Button type="submit" disabled={!hasChanged || isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}
