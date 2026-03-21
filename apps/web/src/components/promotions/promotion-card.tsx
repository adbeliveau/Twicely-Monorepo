'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import { PromotionStatusBadge, derivePromotionStatus, type PromotionStatus } from './promotion-status-badge';
import type { PromotionRow } from '@/lib/queries/promotions';

function formatDiscount(promo: PromotionRow): string {
  if (promo.type === 'PERCENT_OFF' && promo.discountPercent) return `${promo.discountPercent}% off`;
  if (promo.type === 'AMOUNT_OFF' && promo.discountAmountCents) return `$${(promo.discountAmountCents / 100).toFixed(2)} off`;
  if (promo.type === 'FREE_SHIPPING') return 'Free shipping';
  if (promo.type === 'BUNDLE_DISCOUNT' && promo.discountPercent) return `${promo.discountPercent}% bundle`;
  return '';
}

function formatScope(promo: PromotionRow): string {
  if (promo.scope === 'STORE_WIDE') return 'Store-wide';
  if (promo.scope === 'CATEGORY') return `${promo.applicableCategoryIds.length} categories`;
  if (promo.scope === 'SPECIFIC_LISTINGS') return `${promo.applicableListingIds.length} listings`;
  return '';
}

function formatDateRange(promo: PromotionRow): string {
  const start = promo.startsAt.toLocaleDateString();
  if (!promo.endsAt) return `From ${start}`;
  return `${start} - ${promo.endsAt.toLocaleDateString()}`;
}

interface PromotionCardProps {
  promotion: PromotionRow;
  onDeactivate?: (id: string) => void;
  onReactivate?: (id: string) => void;
}

export function PromotionCard({ promotion, onDeactivate, onReactivate }: PromotionCardProps) {
  const status: PromotionStatus = derivePromotionStatus(promotion);
  const canDeactivate = status === 'active' || status === 'scheduled';
  const canReactivate = status === 'paused' && (!promotion.endsAt || promotion.endsAt > new Date());

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-medium">{promotion.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{formatDiscount(promotion)} · {formatScope(promotion)}</p>
        </div>
        <PromotionStatusBadge status={status} />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">{formatDateRange(promotion)}</p>
            {promotion.couponCode && <p className="font-mono text-xs">Code: {promotion.couponCode}</p>}
            <p className="text-muted-foreground">Used {promotion.usageCount} times</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/my/selling/promotions/${promotion.id}`}>Edit</Link>
            </Button>
            {canDeactivate && onDeactivate && (
              <Button variant="ghost" size="sm" onClick={() => onDeactivate(promotion.id)}>Pause</Button>
            )}
            {canReactivate && onReactivate && (
              <Button variant="ghost" size="sm" onClick={() => onReactivate(promotion.id)}>Resume</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
