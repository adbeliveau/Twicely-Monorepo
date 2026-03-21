/**
 * Trial Banner — Shows trial eligibility CTA
 *
 * Server component that fetches eligibility and renders a banner
 * if the user is eligible for a free trial.
 */

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { getTrialEligibility, getProductDisplayName } from '@/lib/queries/trial-eligibility';
import type { TrialProductType } from '@twicely/stripe/trials';
import { Button } from '@twicely/ui/button';

interface TrialBannerProps {
  userId: string;
  productType: TrialProductType;
  subscribeUrl?: string;
}

export async function TrialBanner({
  userId,
  productType,
  subscribeUrl = '/pricing',
}: TrialBannerProps) {
  const eligibility = await getTrialEligibility(userId, productType);

  if (!eligibility.eligible) {
    return null;
  }

  const productName = getProductDisplayName(productType);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">
            Try {productName} free for {eligibility.trialDays} days
          </p>
          <p className="text-sm text-muted-foreground">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </div>
      <Button asChild size="sm">
        <Link href={subscribeUrl}>Start Free Trial</Link>
      </Button>
    </div>
  );
}
