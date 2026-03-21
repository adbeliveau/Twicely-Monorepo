'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@twicely/ui/button';
import { Textarea } from '@twicely/ui/textarea';
import { Label } from '@twicely/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { RadioGroup, RadioGroupItem } from '@twicely/ui/radio-group';
import { activateVacation, deactivateVacation } from '@/lib/actions/vacation';

interface VacationSettingsProps {
  vacationMode: boolean;
  vacationModeType: string | null;
  vacationMessage: string | null;
  vacationAutoReplyMessage: string | null;
  vacationStartAt: Date | null;
  vacationEndAt: Date | null;
  unfulfilledOrderCount: number;
  pendingOffersCount: number;
}

type ModeType = 'PAUSE_SALES' | 'ALLOW_SALES' | 'CUSTOM';

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function VacationSettings({
  vacationMode,
  vacationModeType,
  vacationMessage,
  vacationAutoReplyMessage,
  vacationEndAt,
  unfulfilledOrderCount,
  pendingOffersCount,
}: VacationSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [modeType, setModeType] = useState<ModeType>('PAUSE_SALES');
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState('');
  const [msgValue, setMsgValue] = useState(vacationMessage ?? '');
  const [replyValue, setReplyValue] = useState(vacationAutoReplyMessage ?? '');
  const [isPending, startTransition] = useTransition();

  const maxDays = modeType === 'ALLOW_SALES' ? 15 : 30;

  function handleActivate() {
    if (!endDate) {
      toast.error('End date is required');
      return;
    }
    startTransition(async () => {
      const result = await activateVacation({
        modeType,
        vacationMessage: msgValue || undefined,
        autoReplyMessage: replyValue || undefined,
        startAt: new Date(startDate).toISOString(),
        endAt: new Date(endDate).toISOString(),
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to activate vacation mode');
        return;
      }
      toast.success('Vacation mode activated');
      if (result.unfulfilledOrderCount && result.unfulfilledOrderCount > 0) {
        toast.warning(`You have ${result.unfulfilledOrderCount} unfulfilled orders that need to ship.`);
      }
      setExpanded(false);
    });
  }

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivateVacation();
      if (!result.success) {
        toast.error(result.error ?? 'Failed to end vacation mode');
        return;
      }
      toast.success('Vacation mode ended');
    });
  }

  if (vacationMode) {
    const returnDate = vacationEndAt
      ? vacationEndAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vacation Mode</CardTitle>
          <CardDescription>
            {vacationModeType === 'ALLOW_SALES' ? 'Allow Sales (Delayed Shipping)' : vacationModeType ?? 'Active'}
            {returnDate && ` — returns ${returnDate}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleDeactivate} disabled={isPending}>
            {isPending ? 'Ending vacation...' : 'End Vacation Early'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vacation Mode</CardTitle>
        <CardDescription>Pause or manage your store while you are away.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!expanded ? (
          <Button variant="outline" onClick={() => setExpanded(true)}>
            Enable Vacation Mode
          </Button>
        ) : (
          <div className="space-y-4">
            {unfulfilledOrderCount > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                You have {unfulfilledOrderCount} order{unfulfilledOrderCount > 1 ? 's' : ''} that need to ship before you leave.
              </div>
            )}
            {pendingOffersCount > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {pendingOffersCount} pending offer{pendingOffersCount > 1 ? 's' : ''} will be auto-declined when you activate vacation mode.
              </div>
            )}
            <div className="space-y-2">
              <Label>Mode</Label>
              <RadioGroup
                value={modeType}
                onValueChange={(v) => setModeType(v as ModeType)}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="PAUSE_SALES" id="mode-pause" />
                  <Label htmlFor="mode-pause">Pause Sales</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ALLOW_SALES" id="mode-allow" />
                  <Label htmlFor="mode-allow">Allow Sales (Delayed Shipping)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CUSTOM" id="mode-custom" />
                  <Label htmlFor="mode-custom">Custom</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">Max {maxDays} days for this mode.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="start-date">Start Date</Label>
                <input
                  id="start-date"
                  type="date"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={startDate}
                  min={toDateInputValue(new Date())}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-date">End Date (required)</Label>
                <input
                  id="end-date"
                  type="date"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vac-message">Vacation Message</Label>
              <Textarea
                id="vac-message"
                placeholder="This message will appear on your storefront"
                maxLength={500}
                value={msgValue}
                onChange={(e) => setMsgValue(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="auto-reply">Auto-Reply Message</Label>
              <Textarea
                id="auto-reply"
                placeholder="Thanks for your message! I'm currently away until [return date]. I'll respond when I return."
                maxLength={500}
                value={replyValue}
                onChange={(e) => setReplyValue(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This message will be automatically sent when buyers message you.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleActivate} disabled={isPending}>
                {isPending ? 'Activating...' : 'Activate Vacation Mode'}
              </Button>
              <Button variant="ghost" onClick={() => setExpanded(false)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
