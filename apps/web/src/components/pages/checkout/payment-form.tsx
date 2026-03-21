'use client';

import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@twicely/ui/button';
import { formatPrice } from '@twicely/utils/format';
import { Loader2, Lock } from 'lucide-react';

interface PaymentFormProps {
  onSuccess: (paymentIntentId: string) => void;
  totalCents: number;
  orderId: string;
}

export function PaymentForm({ onSuccess, totalCents, orderId }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/confirmation/${orderId}`,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message ?? 'Payment failed. Please try again.');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    } else if (paymentIntent && paymentIntent.status === 'requires_action') {
      // 3D Secure or other action required - Stripe handles this
      setError('Additional authentication required. Please complete the verification.');
      setIsProcessing(false);
    } else {
      setError('Payment could not be processed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border bg-white p-6">
        <h2 className="font-semibold mb-4">Payment Details</h2>

        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={!stripe || !elements || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" />
            Pay {formatPrice(totalCents)}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Your payment is secured with 256-bit SSL encryption
      </p>
    </form>
  );
}
