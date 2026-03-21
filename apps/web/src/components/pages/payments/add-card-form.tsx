'use client';

import { useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripePromise } from '@twicely/stripe/client';
import { Button } from '@twicely/ui/button';
import { Loader2 } from 'lucide-react';
import { listPaymentMethods } from '@/lib/actions/payment-methods';
import type { SerializedPaymentMethod } from '@/lib/actions/payment-methods';

interface AddCardFormProps {
  clientSecret: string;
  onSuccess: (paymentMethod: SerializedPaymentMethod) => void;
  onCancel: () => void;
}

function CardForm({ clientSecret, onSuccess, onCancel }: AddCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card input not found. Please refresh the page.');
      setProcessing(false);
      return;
    }

    const { error: setupError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (setupError) {
      setError(setupError.message ?? 'Failed to save card');
      setProcessing(false);
      return;
    }

    if (!setupIntent) {
      setError('Setup did not complete. Please try again.');
      setProcessing(false);
      return;
    }

    // Refresh list to get the newly saved card
    const result = await listPaymentMethods();
    const newPmId =
      typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

    const addedPm = result.paymentMethods.find((pm) => pm.id === newPmId);
    if (addedPm) {
      onSuccess(addedPm);
    } else if (result.paymentMethods.length > 0) {
      // Fallback: use the first returned card
      onSuccess(result.paymentMethods[0]!);
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="rounded-md border border-input bg-white p-3">
        <CardElement options={{ style: { base: { fontSize: '14px' } } }} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!stripe || processing}
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save card'}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function AddCardForm(props: AddCardFormProps) {
  return (
    <Elements
      stripe={getStripePromise()}
      options={{ clientSecret: props.clientSecret }}
    >
      <CardForm {...props} />
    </Elements>
  );
}
