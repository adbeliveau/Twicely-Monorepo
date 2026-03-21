'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { adminDeactivatePromotion, adminReactivatePromotion, adminUpdatePromoCode } from '@/lib/actions/admin-promotions';

export function PromotionActionButtons({ promotionId, isActive }: { promotionId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      if (isActive) {
        await adminDeactivatePromotion({ promotionId });
      } else {
        await adminReactivatePromotion({ promotionId });
      }
      router.refresh();
    });
  }

  return (
    <Button
      variant={isActive ? 'destructive' : 'default'}
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
    >
      {isPending ? 'Updating...' : isActive ? 'Deactivate' : 'Reactivate'}
    </Button>
  );
}

export function PromoCodeActionButtons({ codeId, isActive }: { codeId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      await adminUpdatePromoCode({ id: codeId, isActive: !isActive });
      router.refresh();
    });
  }

  return (
    <Button
      variant={isActive ? 'destructive' : 'default'}
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
    >
      {isPending ? 'Updating...' : isActive ? 'Deactivate' : 'Reactivate'}
    </Button>
  );
}
