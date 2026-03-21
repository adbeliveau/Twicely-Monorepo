import { type DealBadgeType, getDealBadgeLabel, getDealBadgeColor } from '@twicely/commerce/deal-badges';
import { Tag, TrendingDown, Zap, AlertCircle } from 'lucide-react';
import { cn } from '@twicely/utils';

interface DealBadgeProps {
  badge: DealBadgeType;
  size?: 'sm' | 'md';
  className?: string;
}

const iconMap = {
  GREAT_PRICE: Tag,
  PRICE_DROP: TrendingDown,
  FAST_SELLER: Zap,
  LAST_ONE: AlertCircle,
} as const;

export function DealBadge({ badge, size = 'sm', className }: DealBadgeProps) {
  if (!badge) return null;

  const label = getDealBadgeLabel(badge);
  const colorClass = getDealBadgeColor(badge);
  const Icon = iconMap[badge];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        colorClass,
        className
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {label}
    </span>
  );
}
