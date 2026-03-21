import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

interface AwaitingShipmentAlertProps {
  count: number;
}

export function AwaitingShipmentAlert({ count }: AwaitingShipmentAlertProps) {
  if (count === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-orange-900">
            {count} {count === 1 ? 'order' : 'orders'} awaiting shipment
          </h3>
          <p className="mt-1 text-sm text-orange-700">
            Ship soon to maintain your on-time shipping rate and avoid late shipment flags.
          </p>
          <div className="mt-3">
            <Link
              href="/my/selling/orders?status=AWAITING_SHIPMENT"
              className="inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
            >
              View Orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
