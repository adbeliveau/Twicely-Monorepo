'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Package, AlertCircle } from 'lucide-react';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { OrderStatusBadge } from './order-status-badge';
import type { SellerOrderSummary } from '@/lib/queries/orders';
import { cn } from '@twicely/utils';

interface SellerOrderListProps {
  orders: SellerOrderSummary[];
}

type FilterStatus = 'AWAITING_SHIPMENT' | 'SHIPPED' | 'DELIVERED' | 'ALL' | 'CANCELED';

export function SellerOrderList({ orders: initialOrders }: SellerOrderListProps) {
  const [filter, setFilter] = useState<FilterStatus>('AWAITING_SHIPMENT');

  const filters: { label: string; value: FilterStatus }[] = [
    { label: 'Awaiting Shipment', value: 'AWAITING_SHIPMENT' },
    { label: 'Shipped', value: 'SHIPPED' },
    { label: 'Delivered', value: 'DELIVERED' },
    { label: 'All', value: 'ALL' },
    { label: 'Canceled', value: 'CANCELED' },
  ];

  // Client-side filtering
  const filteredOrders = initialOrders.filter((order) => {
    if (filter === 'ALL') return true;
    if (filter === 'AWAITING_SHIPMENT') return order.status === 'PAID';
    if (filter === 'SHIPPED') return order.status === 'SHIPPED';
    if (filter === 'DELIVERED')
      return order.status === 'DELIVERED' || order.status === 'COMPLETED';
    if (filter === 'CANCELED') return order.status === 'CANCELED';
    return true;
  });

  // Calculate ship-by deadline info
  function getShipByInfo(order: SellerOrderSummary) {
    if (order.status !== 'PAID' || !order.expectedShipByAt) {
      return null;
    }

    const now = new Date();
    const deadline = new Date(order.expectedShipByAt);
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (order.isLateShipment || diffDays < 0) {
      return { label: 'LATE', color: 'text-red-600 bg-red-50', urgent: true };
    } else if (diffDays === 0) {
      return { label: 'Ship today', color: 'text-red-600 bg-red-50', urgent: true };
    } else if (diffDays === 1) {
      return { label: 'Ship by tomorrow', color: 'text-yellow-600 bg-yellow-50', urgent: true };
    } else if (diffDays === 2) {
      return { label: `Ship by ${formatDate(deadline)}`, color: 'text-yellow-600 bg-yellow-50', urgent: false };
    } else {
      return { label: `Ship by ${formatDate(deadline)}`, color: 'text-green-600 bg-green-50', urgent: false };
    }
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={
                filter === f.value
                  ? 'border-primary text-primary whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
              }
            >
              {f.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No orders</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filter === 'AWAITING_SHIPMENT'
              ? 'No orders awaiting shipment'
              : 'No orders in this category'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const shipByInfo = getShipByInfo(order);

            return (
              <div
                key={order.orderId}
                className={cn(
                  'block rounded-lg border bg-white p-4 transition-shadow',
                  shipByInfo?.urgent && 'border-orange-200 bg-orange-50'
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    {order.firstItemThumbnail ? (
                      <Image
                        src={order.firstItemThumbnail}
                        alt={order.firstItemTitle}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Order details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {order.firstItemTitle}
                        </p>
                        {order.itemCount > 1 && (
                          <p className="text-xs text-gray-500 mt-1">
                            +{order.itemCount - 1} more item
                            {order.itemCount > 2 ? 's' : ''}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Order #{order.orderNumber} • {order.buyerName}
                        </p>
                      </div>

                      <OrderStatusBadge status={order.status} />
                    </div>

                    {/* Ship-by deadline for PAID orders */}
                    {shipByInfo && (
                      <div className={cn('inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mb-2', shipByInfo.color)}>
                        {shipByInfo.urgent && <AlertCircle className="h-3 w-3" />}
                        {shipByInfo.label}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm text-gray-500">
                        {formatDate(order.createdAt)}
                      </p>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatPrice(order.totalCents)}
                        </p>
                        {order.status === 'PAID' && (
                          <Link
                            href={`/my/selling/orders/${order.orderId}/ship`}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90"
                          >
                            Ship
                          </Link>
                        )}
                        <Link
                          href={`/my/selling/orders/${order.orderId}`}
                          className="text-sm text-primary hover:text-primary/80"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
