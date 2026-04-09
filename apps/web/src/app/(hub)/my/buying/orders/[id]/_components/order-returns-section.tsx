import { RotateCcw, AlertCircle } from 'lucide-react';
import { getReturnsForOrder, hasActiveReturn } from '@/lib/queries/returns';
import { formatDate } from '@twicely/utils/format';

const RETURN_STATUS_LABELS: Record<string, string> = {
  PENDING_SELLER: 'Awaiting seller response',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  PARTIAL_OFFERED: 'Partial refund offered',
  BUYER_ACCEPTS_PARTIAL: 'Partial refund accepted',
  BUYER_DECLINES_PARTIAL: 'Partial refund declined',
  LABEL_GENERATED: 'Return label generated',
  SHIPPED: 'Return shipped',
  DELIVERED: 'Return received',
  REFUND_ISSUED: 'Refunded',
  CONDITION_DISPUTE: 'Condition dispute',
  BUYER_ACCEPTS: 'Resolution accepted',
  ESCALATED: 'Escalated to Twicely',
  CLOSED: 'Closed',
};

const REASON_LABELS: Record<string, string> = {
  INAD: 'Not as described',
  DAMAGED: 'Arrived damaged',
  WRONG_ITEM: 'Wrong item',
  COUNTERFEIT: 'Counterfeit',
  REMORSE: 'Changed mind',
  INR: 'Not received',
};

interface OrderReturnsSectionProps {
  orderId: string;
}

export async function OrderReturnsSection({ orderId }: OrderReturnsSectionProps) {
  const [returns, activeReturn] = await Promise.all([
    getReturnsForOrder(orderId),
    hasActiveReturn(orderId),
  ]);

  if (returns.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center gap-2 mb-4">
        <RotateCcw className="h-5 w-5 text-gray-600" />
        <h2 className="font-semibold">Returns</h2>
        {activeReturn && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3" />
            Return in progress
          </span>
        )}
      </div>

      <div className="divide-y">
        {returns.map((ret) => (
          <div key={ret.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {REASON_LABELS[ret.reason] ?? ret.reason}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {RETURN_STATUS_LABELS[ret.status] ?? ret.status}
                  {' · '}
                  {formatDate(ret.createdAt)}
                </p>
                {ret.description && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{ret.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
