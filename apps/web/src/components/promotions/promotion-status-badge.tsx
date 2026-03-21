'use client';

import { Badge } from '@twicely/ui/badge';

export type PromotionStatus = 'active' | 'scheduled' | 'ended' | 'paused';

export interface PromotionStatusData {
  isActive: boolean;
  startsAt: Date;
  endsAt: Date | null;
}

export function derivePromotionStatus(promo: PromotionStatusData, now = new Date()): PromotionStatus {
  if (!promo.isActive) return 'paused';
  if (promo.startsAt > now) return 'scheduled';
  if (promo.endsAt && now >= promo.endsAt) return 'ended';
  return 'active';
}

const STATUS_CONFIG: Record<PromotionStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  active: { label: 'Active', variant: 'default' },
  scheduled: { label: 'Scheduled', variant: 'secondary' },
  ended: { label: 'Ended', variant: 'outline' },
  paused: { label: 'Paused', variant: 'destructive' },
};

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
