'use client';

import { useTransition, useState } from 'react';
import { refundOrderAction, cancelOrderAction, overrideOrderStatusAction } from '@/lib/actions/admin-orders';

interface OrderActionsProps {
  orderId: string;
  totalCents: number;
  canUpdate: boolean;
  canManage: boolean;
}

export function OrderActions({ orderId, totalCents, canUpdate, canManage }: OrderActionsProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleRefund() {
    const amountStr = prompt(`Refund amount in cents (max ${totalCents}):`);
    if (!amountStr) return;
    const amountCents = parseInt(amountStr, 10);
    if (isNaN(amountCents) || amountCents <= 0) return;
    const reason = prompt('Refund reason:');
    if (!reason) return;
    const isPartial = amountCents < totalCents;

    startTransition(async () => {
      const res = await refundOrderAction({ orderId, amountCents, reason, isPartial });
      setResult(res.error ?? (isPartial ? 'Partial refund issued' : 'Full refund issued'));
    });
  }

  function handleCancel() {
    const reason = prompt('Cancellation reason:');
    if (!reason) return;
    startTransition(async () => {
      const res = await cancelOrderAction({ orderId, reason });
      setResult(res.error ?? 'Order canceled');
    });
  }

  function handleOverride() {
    const newStatus = prompt('New status (PAID, PROCESSING, SHIPPED, DELIVERED, COMPLETED, CANCELED, REFUNDED):');
    if (!newStatus) return;
    const reason = prompt('Override reason:');
    if (!reason) return;
    startTransition(async () => {
      const res = await overrideOrderStatusAction({ orderId, newStatus, reason });
      setResult(res.error ?? `Status overridden to ${newStatus}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {canUpdate && (
        <>
          <button onClick={handleRefund} disabled={pending} className="rounded bg-orange-600 px-3 py-1.5 text-xs text-white hover:bg-orange-700 disabled:opacity-50">
            Issue Refund
          </button>
          <button onClick={handleCancel} disabled={pending} className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50">
            Cancel Order
          </button>
        </>
      )}
      {canManage && (
        <button onClick={handleOverride} disabled={pending} className="rounded bg-gray-600 px-3 py-1.5 text-xs text-white hover:bg-gray-700 disabled:opacity-50">
          Override Status
        </button>
      )}
      {result && <span className="text-xs text-gray-500">{result}</span>}
    </div>
  );
}
