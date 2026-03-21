import { Badge } from '@twicely/ui/badge';
import { cn } from '@twicely/utils';

const conditionConfig: Record<
  string,
  { label: string; className: string }
> = {
  NWT: {
    label: 'New with Tags',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  NWOT: {
    label: 'New without Tags',
    className: 'bg-green-50 text-green-700 hover:bg-green-50',
  },
  NEW_WITH_TAGS: {
    label: 'New with Tags',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  NEW_WITHOUT_TAGS: {
    label: 'New without Tags',
    className: 'bg-green-50 text-green-700 hover:bg-green-50',
  },
  LIKE_NEW: {
    label: 'Like New',
    className: 'bg-primary/10 text-primary hover:bg-primary/10',
  },
  VERY_GOOD: {
    label: 'Very Good',
    className: 'bg-primary/5 text-primary hover:bg-primary/5',
  },
  GOOD: {
    label: 'Good',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
  ACCEPTABLE: {
    label: 'Acceptable',
    className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  },
};

interface ConditionBadgeProps {
  condition: string;
}

export function ConditionBadge({ condition }: ConditionBadgeProps) {
  const config = conditionConfig[condition] ?? {
    label: condition,
    className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  };

  return (
    <Badge variant="secondary" className={cn('text-xs', config.className)}>
      {config.label}
    </Badge>
  );
}
