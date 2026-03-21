import { type BuyerQualityTier, getBuyerQualityDescription } from '@twicely/commerce/buyer-quality';
import { cn } from '@twicely/utils';

interface BuyerQualityIndicatorProps {
  tier: BuyerQualityTier;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const tierColors = {
  GREEN: {
    dot: 'bg-green-500',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  YELLOW: {
    dot: 'bg-yellow-500',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  RED: {
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
} as const;

export function BuyerQualityIndicator({
  tier,
  showLabel = false,
  size = 'sm',
  className,
}: BuyerQualityIndicatorProps) {
  const colors = tierColors[tier];
  const description = getBuyerQualityDescription(tier);

  if (!showLabel) {
    // Just the dot
    return (
      <span
        title={description}
        className={cn(
          'inline-block rounded-full',
          size === 'sm' ? 'h-2 w-2' : 'h-3 w-3',
          colors.dot,
          className
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      <span className={cn('rounded-full', size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5', colors.dot)} />
      {description}
    </span>
  );
}

interface BuyerQualityWarningProps {
  tier: BuyerQualityTier;
  className?: string;
}

export function BuyerQualityWarning({ tier, className }: BuyerQualityWarningProps) {
  if (tier === 'GREEN') return null;

  const colors = tierColors[tier];
  const description = getBuyerQualityDescription(tier);

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border p-3',
        colors.bg,
        colors.border,
        className
      )}
    >
      <span className={cn('h-3 w-3 rounded-full', colors.dot)} />
      <div className="flex-1">
        <p className={cn('text-sm font-medium', colors.text)}>
          {tier === 'YELLOW' ? 'Caution' : 'Warning'}: Buyer has {description.toLowerCase()}
        </p>
        <p className="text-xs text-muted-foreground">
          {tier === 'YELLOW'
            ? 'This buyer has some elevated risk indicators.'
            : 'This buyer has high risk indicators. Consider carefully.'}
        </p>
      </div>
    </div>
  );
}
