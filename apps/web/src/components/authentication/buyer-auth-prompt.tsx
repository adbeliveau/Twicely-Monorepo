'use client';

import { useState } from 'react';
import { ShieldCheck, Info } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { Card, CardContent } from '@twicely/ui/card';

type BuyerAuthPromptProps = {
  buyerFeeCents: number;
  onAccept: () => void;
  onDecline: () => void;
  isLoading?: boolean;
};

export function BuyerAuthPrompt({
  buyerFeeCents,
  onAccept,
  onDecline,
  isLoading = false,
}: BuyerAuthPromptProps) {
  const [decided, setDecided] = useState(false);

  const feeDisplay = `$${(buyerFeeCents / 100).toFixed(2)}`;

  function handleAccept() {
    setDecided(true);
    onAccept();
  }

  function handleDecline() {
    setDecided(true);
    onDecline();
  }

  if (decided) return null;

  return (
    <Card className="border-indigo-200 bg-indigo-50">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-indigo-900">
                Would you like this item authenticated?
              </p>
              <p className="mt-0.5 text-sm text-indigo-700">
                Your share: {feeDisplay} — split 50/50 with the seller if authentic.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={isLoading}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Yes, authenticate ({feeDisplay})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDecline}
                disabled={isLoading}
              >
                No thanks
              </Button>
            </div>
            <div className="flex items-start gap-1.5 rounded-md bg-white/60 p-2">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
              <p className="text-xs text-indigo-600">
                Authentication services are provided by independent third-party partners. Twicely
                facilitates the authentication process but does not independently verify item
                authenticity. Declining authentication does not affect your buyer protection
                coverage.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
