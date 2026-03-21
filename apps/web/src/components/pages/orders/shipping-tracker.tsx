import { Check } from 'lucide-react';
import { cn } from '@twicely/utils';
import { formatDate } from '@twicely/utils/format';

interface ShippingTrackerProps {
  status: string;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
}

export function ShippingTracker({
  status,
  paidAt,
  shippedAt,
  deliveredAt,
}: ShippingTrackerProps) {
  // If canceled, show canceled state
  if (status === 'CANCELED') {
    return (
      <div className="rounded-lg border bg-red-50 p-6">
        <p className="text-center text-sm font-medium text-red-800">Order Canceled</p>
      </div>
    );
  }

  const steps = [
    {
      key: 'ordered',
      label: 'Ordered',
      date: paidAt,
      completed: !!paidAt,
      active: status === 'PAID',
    },
    {
      key: 'shipped',
      label: 'Shipped',
      date: shippedAt,
      completed: !!shippedAt,
      active: status === 'SHIPPED',
    },
    {
      key: 'in-transit',
      label: 'In Transit',
      date: null,
      completed: status === 'DELIVERED' || status === 'COMPLETED',
      active: status === 'SHIPPED',
    },
    {
      key: 'delivered',
      label: 'Delivered',
      date: deliveredAt,
      completed: !!deliveredAt,
      active: status === 'DELIVERED' || status === 'COMPLETED',
    },
  ];

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-sm font-semibold mb-6">Shipping Status</h3>

      {/* Horizontal progress bar */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => (
            <div key={step.key} className="flex flex-col items-center">
              {/* Circle */}
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white',
                  step.completed
                    ? 'border-green-500 bg-green-500'
                    : step.active
                    ? 'border-primary bg-primary'
                    : 'border-gray-300'
                )}
              >
                {step.completed ? (
                  <Check className="h-5 w-5 text-white" />
                ) : (
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      step.active ? 'text-white' : 'text-gray-400'
                    )}
                  >
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <p
                className={cn(
                  'mt-2 text-xs font-medium',
                  step.completed || step.active ? 'text-gray-900' : 'text-gray-500'
                )}
              >
                {step.label}
              </p>

              {/* Date */}
              {step.date && (
                <p className="mt-1 text-xs text-gray-500">{formatDate(step.date)}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
