'use client';

/**
 * Stripe Identity Embed — G6
 *
 * Client component that loads the Stripe Identity embedded verification UI.
 * Uses @stripe/stripe-js for secure, Stripe-hosted document capture.
 * Twicely does NOT receive or store raw ID images.
 */

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { startEnhancedVerification } from '@/lib/actions/identity-verification';
import type { ComponentPropsWithoutRef } from 'react';

interface Props extends ComponentPropsWithoutRef<'div'> {
  triggeredBy?: 'STORE_PRO_UPGRADE' | 'PAYOUT_THRESHOLD' | 'FRAUD_FLAG' | 'CATEGORY_REQUIREMENT' | 'ADMIN_REQUEST' | 'USER_INITIATED';
  onComplete?: () => void;
}

type FlowState = 'idle' | 'starting' | 'verifying' | 'success' | 'error';

export function StripeIdentityEmbed({
  triggeredBy = 'USER_INITIATED',
  onComplete,
  ...props
}: Props) {
  const [state, setState] = useState<FlowState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleStart() {
    setState('starting');
    setErrorMessage(null);

    const result = await startEnhancedVerification({ triggeredBy });

    if (!result.success || !result.clientSecret) {
      setState('error');
      setErrorMessage(result.error ?? 'Failed to start verification. Please try again.');
      return;
    }

    // Dynamic import to avoid SSR issues with @stripe/stripe-js
    try {
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (!stripePublicKey) {
        setState('error');
        setErrorMessage('Stripe is not configured.');
        return;
      }

      const stripeInstance = await loadStripe(stripePublicKey);
      if (!stripeInstance) {
        setState('error');
        setErrorMessage('Failed to load Stripe. Please try again.');
        return;
      }

      setState('verifying');

      // Use Stripe Identity's verifyIdentity modal
      const { error } = await stripeInstance.verifyIdentity(result.clientSecret);

      if (error) {
        setState('error');
        setErrorMessage(error.message ?? 'Verification was not completed.');
        return;
      }

      setState('success');
      onComplete?.();
    } catch {
      setState('error');
      setErrorMessage('An unexpected error occurred. Please try again.');
    }
  }

  return (
    <div {...props}>
      {state === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Identity verification is powered by Stripe Identity. Your documents are
            processed by Stripe and Twicely only receives a verification status.
          </p>
          <Button onClick={handleStart} type="button">
            Start Identity Verification
          </Button>
        </div>
      )}

      {state === 'starting' && (
        <p className="text-sm text-muted-foreground">Starting verification session...</p>
      )}

      {state === 'verifying' && (
        <p className="text-sm text-muted-foreground">
          A verification window has opened. Please complete the steps in that window.
        </p>
      )}

      {state === 'success' && (
        <p className="text-sm text-green-700">
          Verification submitted. We will notify you once the review is complete.
        </p>
      )}

      {state === 'error' && errorMessage && (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <Button
            onClick={() => { setState('idle'); setErrorMessage(null); }}
            variant="outline"
            type="button"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
