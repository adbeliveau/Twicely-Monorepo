'use client';

import { Elements } from '@stripe/react-stripe-js';
import { getStripePromise } from '@twicely/stripe/client';
import type { StripeElementsOptions } from '@stripe/stripe-js';

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

/**
 * Stripe Elements provider wrapper.
 * Wraps children with Stripe Elements context using the provided clientSecret.
 */
export function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0f172a',
        colorBackground: '#ffffff',
        colorText: '#1e293b',
        colorDanger: '#dc2626',
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '8px',
      },
    },
  };

  return (
    <Elements stripe={getStripePromise()} options={options}>
      {children}
    </Elements>
  );
}
