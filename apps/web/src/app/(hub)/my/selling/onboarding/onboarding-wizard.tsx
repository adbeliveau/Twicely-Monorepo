'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Loader2, CheckCircle2, Store } from 'lucide-react';
import { enableSellerAction } from '@/lib/actions/seller-onboarding';
import { BusinessInfoStep } from './steps/business-info-step';
import { PayoutSetupStep } from './steps/payout-setup-step';
import { StoreProfileStep } from './steps/store-profile-step';
import { CompletionStep } from './steps/completion-step';
import type { BusinessInfoRecord } from '@/lib/queries/business-info';

interface OnboardingWizardProps {
  flow: 'activate' | 'business';
  isSeller: boolean;
  initialStep: 1 | 2 | 3 | 4;
  businessInfo: BusinessInfoRecord | null;
  stripeOnboarded: boolean;
  payoutsEnabled: boolean;
  storeName: string | null;
  storeSlug: string | null;
}

const STEP_LABELS = ['Business Info', 'Payout Setup', 'Store Profile', 'Done'] as const;

function ProgressBar({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = (idx + 1) as 1 | 2 | 3 | 4;
        const isDone = currentStep > stepNum;
        const isCurrent = currentStep === stepNum;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className="flex items-center gap-1.5">
              <div
                className={[
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                  isDone
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={[
                  'text-xs hidden sm:block',
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className={[
                  'flex-1 h-px mx-1',
                  isDone ? 'bg-green-500' : 'bg-muted',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingWizard({
  flow,
  isSeller,
  initialStep,
  businessInfo,
  stripeOnboarded,
  payoutsEnabled,
  storeName,
  storeSlug,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep);
  const [isActivating, setIsActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  // Path A: one-click personal seller activation (only when explicitly requested or no business flow)
  if (flow === 'activate' || (!isSeller && flow !== 'business')) {
    const handleActivate = async () => {
      setIsActivating(true);
      setActivateError(null);

      const result = await enableSellerAction();

      if (result.success) {
        router.push('/my/selling/listings/new');
      } else {
        setActivateError(result.error ?? 'Something went wrong');
        setIsActivating(false);
      }
    };

    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center max-w-md mx-auto">
        <Store className="h-16 w-16 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Start selling on Twicely</h2>
          <p className="mt-2 text-muted-foreground">
            Create your seller account instantly. No fees to start — only pay when you sell.
          </p>
        </div>

        {activateError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 w-full">
            {activateError}
          </div>
        )}

        <div className="flex flex-col gap-3 w-full">
          <Button size="lg" onClick={handleActivate} disabled={isActivating}>
            {isActivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Selling
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="/my/selling/onboarding?flow=business">Open a business store instead</a>
          </Button>
        </div>
      </div>
    );
  }

  // Path B: multi-step business wizard
  function advance() {
    setStep((prev) => Math.min(prev + 1, 4) as 1 | 2 | 3 | 4);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Open a Business Store</h1>
        <p className="text-muted-foreground mt-1">
          Complete the steps below to set up your business account.
        </p>
      </div>

      <ProgressBar currentStep={step} />

      {step === 1 && (
        <BusinessInfoStep existing={businessInfo} onComplete={advance} />
      )}

      {step === 2 && (
        <PayoutSetupStep
          stripeOnboarded={stripeOnboarded}
          payoutsEnabled={payoutsEnabled}
          onComplete={advance}
        />
      )}

      {step === 3 && (
        <StoreProfileStep
          existingStoreName={storeName}
          existingStoreSlug={storeSlug}
          onComplete={advance}
        />
      )}

      {step === 4 && <CompletionStep storeName={storeName} />}
    </div>
  );
}
