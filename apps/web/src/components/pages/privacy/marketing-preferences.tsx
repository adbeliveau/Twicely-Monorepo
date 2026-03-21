'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Switch } from '@twicely/ui/switch';
import { Label } from '@twicely/ui/label';
import { updateMarketingOptIn } from '@/lib/actions/privacy-settings';

interface Props {
  initialOptIn: boolean;
}

export function MarketingPreferences({ initialOptIn }: Props) {
  const [optIn, setOptIn] = useState(initialOptIn);
  const [isPending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    setOptIn(checked);
    startTransition(async () => {
      await updateMarketingOptIn({ optIn: checked });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marketing Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="marketing-opt-in" className="text-sm font-medium">
              Marketing emails
            </Label>
            <p className="text-xs text-muted-foreground">
              Receive personalized offers, recommendations, and platform news.
            </p>
          </div>
          <Switch
            id="marketing-opt-in"
            checked={optIn}
            onCheckedChange={handleToggle}
            disabled={isPending}
            aria-label="Marketing email preference"
          />
        </div>
      </CardContent>
    </Card>
  );
}
