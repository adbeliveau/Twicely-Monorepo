'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { OrderStatusBadge } from './order-status-badge';
import type { BuyerOrderSummary } from '@/lib/queries/orders';

interface BuyerOrderListProps {
  orders: BuyerOrderSummary[];
}

type FilterStatus = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELED';

export function BuyerOrderList({ orders: initialOrders }: BuyerOrderListProps) {
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const filters: { label: string; value: FilterStatus }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Canceled', value: 'CANCELED' },
  ];

  // Client-side filtering (server already filtered, but this allows UI switching)
  const filteredOrders = initialOrders.filter((order) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE')
      return order.status === 'PAID' || order.status === 'SHIPPED';
    if (filter === 'COMPLETED')
      return order.status === 'DELIVERED' || order.status === 'COMPLETED';
    if (filter === 'CANCELED') return order.status === 'CANCELED';
    return true;
  });

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
            You haven&apos;t bought anything yet.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90"
            >
              Start Shopping
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Link
              key={order.orderId}
              href={`/my/buying/orders/${order.orderId}`}
              className="block rounded-lg border bg-white p-4 hover:shadow-md transition-shadow"
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
                  <div className="flex items-start justify-between gap-4">
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
                        Order #{order.orderNumber}
                      </p>
                    </div>

                    <OrderStatusBadge status={order.status} />
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <p className="text-sm text-gray-500">
                      {formatDate(order.createdAt)}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatPrice(order.totalCents)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
