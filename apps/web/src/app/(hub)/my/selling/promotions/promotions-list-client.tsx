'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@twicely/ui/tabs';
import { PromotionCard } from '@/components/promotions/promotion-card';
import { deactivatePromotion, reactivatePromotion } from '@/lib/actions/promotions';
import type { PromotionRow, PromotionStatus } from '@/lib/queries/promotions';

interface PromotionsListClientProps {
  promotions: PromotionRow[];
  currentStatus: PromotionStatus;
}

export function PromotionsListClient({ promotions, currentStatus }: PromotionsListClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(status: string) {
    router.push(`/my/selling/promotions?status=${status}`);
  }

  function handleDeactivate(id: string) {
    startTransition(async () => {
      await deactivatePromotion(id);
      router.refresh();
    });
  }

  function handleReactivate(id: string) {
    startTransition(async () => {
      await reactivatePromotion(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Tabs value={currentStatus} onValueChange={handleStatusChange}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="ended">Ended</TabsTrigger>
        </TabsList>
      </Tabs>

      {promotions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No promotions found.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={isPending}>
          {promotions.map((promo) => (
            <PromotionCard key={promo.id} promotion={promo} onDeactivate={handleDeactivate} onReactivate={handleReactivate} />
          ))}
        </div>
      )}
    </div>
  );
}
