'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { toast } from 'sonner';
import { adminDeactivatePromotion, adminReactivatePromotion, adminUpdatePromoCode } from '@/lib/actions/admin-promotions';

export function PromotionActionButtons({ promotionId, isActive }: { promotionId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      try {
        const result = isActive
          ? await adminDeactivatePromotion({ promotionId })
          : await adminReactivatePromotion({ promotionId });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to update promotion');
          return;
        }
        toast.success(isActive ? 'Promotion deactivated' : 'Promotion reactivated');
        router.refresh();
      } catch {
        toast.error('An unexpected error occurred');
      }
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
      try {
        const result = await adminUpdatePromoCode({ id: codeId, isActive: !isActive });
        if (!result.success) {
          toast.error(result.error ?? 'Failed to update promo code');
          return;
        }
        toast.success(isActive ? 'Promo code deactivated' : 'Promo code reactivated');
        router.refresh();
      } catch {
        toast.error('An unexpected error occurred');
      }
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
