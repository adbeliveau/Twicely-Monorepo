import { cn } from '@twicely/utils';

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const statusConfig = {
    CREATED: { label: 'Created', color: 'bg-gray-100 text-gray-800' },
    PAID: { label: 'Paid', color: 'bg-primary/10 text-primary' },
    SHIPPED: { label: 'Shipped', color: 'bg-orange-100 text-orange-800' },
    DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
    COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800' },
    CANCELED: { label: 'Canceled', color: 'bg-red-100 text-red-800' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] ?? {
    label: status,
    color: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}
