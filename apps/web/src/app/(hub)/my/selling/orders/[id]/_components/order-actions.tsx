import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { CancelOrderForm } from '@/components/pages/orders/cancel-order-form';
import { Star } from 'lucide-react';
import { formatDate } from '@twicely/utils/format';

interface OrderActionsProps {
  orderId: string;
  status: string;
  isLocalPickup: boolean;
  canRateBuyer: boolean;
  buyerDisplayName: string;
  existingBuyerReview: { id: string; createdAt: Date } | null;
}

export function OrderActions({
  orderId,
  status,
  isLocalPickup,
  canRateBuyer,
  buyerDisplayName,
  existingBuyerReview,
}: OrderActionsProps) {
  return (
    <>
      {/* Action buttons - only show Ship Order for non-local pickup orders */}
      {status === 'PAID' && !isLocalPickup && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <Link href={`/my/selling/orders/${orderId}/ship`}>
              <Button className="w-full">Ship Order</Button>
            </Link>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <CancelOrderForm orderId={orderId} />
          </div>
        </div>
      )}

      {/* Cancel button for local pickup orders */}
      {status === 'PAID' && isLocalPickup && (
        <div className="rounded-lg border bg-white p-4">
          <CancelOrderForm orderId={orderId} />
        </div>
      )}

      {/* Rate Buyer CTA */}
      {canRateBuyer && (
        <div className="rounded-lg border bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-blue-900">Rate this buyer</h3>
              <p className="text-sm text-blue-700">
                Help other sellers by sharing your experience with {buyerDisplayName}
              </p>
            </div>
            <Link href={`/my/selling/orders/${orderId}/review`}>
              <Button size="sm">
                <Star className="h-4 w-4 mr-1.5" />
                Rate Buyer
              </Button>
            </Link>
          </div>
        </div>
      )}

      {existingBuyerReview && (() => {
        const editEnd = new Date(existingBuyerReview.createdAt);
        editEnd.setHours(editEnd.getHours() + 24);
        const canEdit = new Date() <= editEnd;
        return (
          <div className="rounded-lg border bg-green-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-green-600 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  Buyer rated on {formatDate(existingBuyerReview.createdAt)}
                </span>
              </div>
              {canEdit && (
                <Link href={`/my/selling/orders/${orderId}/review`}>
                  <Button size="sm" variant="outline">Edit Review</Button>
                </Link>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
