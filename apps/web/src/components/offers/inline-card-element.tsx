'use client';

import { useState } from 'react';
import { CardElement, useStripe, useElements, Elements } from '@stripe/react-stripe-js';
import { getStripePromise } from '@twicely/stripe/client';
import { Button } from '@twicely/ui/button';
import { Loader2 } from 'lucide-react';

interface InlineCardElementProps {
  onSubmit: (paymentMethodId: string) => Promise<{ success: boolean; error?: string }>;
  submitLabel: string;
  submitVariant?: 'default' | 'destructive' | 'outline';
  isProcessing?: boolean;
}

function CardForm({ onSubmit, submitLabel, submitVariant = 'default', isProcessing }: InlineCardElementProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) { setError('Card element not found'); setProcessing(false); return; }

    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
    if (pmError) { setError(pmError.message ?? 'Failed to process card'); setProcessing(false); return; }

    const result = await onSubmit(paymentMethod.id);
    if (!result.success) setError(result.error ?? 'Action failed');
    setProcessing(false);
  };

  const busy = processing || isProcessing;
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-input bg-white p-2">
        <CardElement options={{ style: { base: { fontSize: '14px' } } }} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="sm" variant={submitVariant} onClick={handleSubmit} disabled={!stripe || busy} className="w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
      </Button>
    </div>
  );
}

export function InlineCardElement(props: InlineCardElementProps) {
  return (
    <Elements stripe={getStripePromise()}>
      <CardForm {...props} />
    </Elements>
  );
}
