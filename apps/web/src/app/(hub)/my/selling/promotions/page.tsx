import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerPromotions, type PromotionStatus } from '@/lib/queries/promotions';
import { getSellerInfoForGates } from '@/lib/queries/storefront';
import { canUseFeature, getMinTierForFeature } from '@twicely/utils/tier-gates';
import { TierGateCTA } from '@/components/storefront/tier-gate-cta';
import { Button } from '@twicely/ui/button';
import { Plus } from 'lucide-react';
import { PromotionsListClient } from './promotions-list-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Promotions | Twicely',
  robots: 'noindex',
};

interface PromotionsPageProps {
  searchParams: Promise<{ status?: string }>;
}

const VALID_STATUSES: PromotionStatus[] = ['active', 'scheduled', 'ended', 'all'];

export default async function PromotionsPage({ searchParams }: PromotionsPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login');

  const userId = session.user.id;
  const gates = await getSellerInfoForGates(userId);
  const storeTier = gates?.storeTier ?? 'NONE';

  if (!canUseFeature(storeTier, 'promotions')) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="text-muted-foreground">Create sales and coupon codes for your store.</p>
        </div>
        <div className="relative rounded-lg border p-8">
          <TierGateCTA feature="promotions" requiredTier={getMinTierForFeature('promotions')} currentTier={storeTier} />
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const statusParam = params.status?.toLowerCase();
  const status: PromotionStatus = VALID_STATUSES.includes(statusParam as PromotionStatus)
    ? (statusParam as PromotionStatus)
    : 'all';

  const promotions = await getSellerPromotions(userId, { status });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="text-muted-foreground">Create sales and coupon codes for your store.</p>
        </div>
        <Button asChild>
          <Link href="/my/selling/promotions/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Promotion
          </Link>
        </Button>
      </div>

      <PromotionsListClient promotions={promotions} currentStatus={status} />
    </div>
  );
}
