'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { formatPrice } from '@twicely/utils/format';
import { CheckCircle2, Package, MapPin } from 'lucide-react';
import type { OrderDetailData } from '@/lib/queries/order-detail';

interface OrderConfirmationProps {
  order: OrderDetailData;
}

export function OrderConfirmation({ order }: OrderConfirmationProps) {
  const address = order.shippingAddressJson as {
    name?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  };

  return (
    <div className="space-y-8">
      {/* Success Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Order Confirmed!</h1>
        <p className="text-muted-foreground">
          Thank you for your purchase. Your order has been received.
        </p>
      </div>

      {/* Order Number */}
      <div className="rounded-lg border bg-white p-6 text-center">
        <p className="text-sm text-muted-foreground mb-1">Order Number</p>
        <p className="text-xl font-mono font-semibold">{order.orderNumber}</p>
        {order.paidAt && (
          <p className="text-sm text-muted-foreground mt-2">
            Placed on {formatDate(order.paidAt)}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Order Items */}
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Items Ordered</h2>
          </div>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="relative h-16 w-16 rounded-md overflow-hidden bg-muted shrink-0">
                  {item.primaryImageUrl ? (
                    <Image
                      src={item.primaryImageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                      No img
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-2">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity} × {formatPrice(item.unitPriceCents)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Address */}
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Shipping Address</h2>
          </div>
          <div className="text-sm space-y-1">
            <p className="font-medium">{address.name}</p>
            <p className="text-muted-foreground">{address.address1}</p>
            {address.address2 && (
              <p className="text-muted-foreground">{address.address2}</p>
            )}
            <p className="text-muted-foreground">
              {address.city}, {address.state} {address.zip}
            </p>
            {address.country && address.country !== 'US' && (
              <p className="text-muted-foreground">{address.country}</p>
            )}
          </div>

          {order.expectedDeliveryAt && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Estimated Delivery</p>
              <p className="font-medium">{formatDate(order.expectedDeliveryAt)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="font-semibold mb-4">Payment Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(order.itemSubtotalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>
              {order.shippingCents === 0 ? 'Free' : formatPrice(order.shippingCents)}
            </span>
          </div>
          {order.taxCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatPrice(order.taxCents)}</span>
            </div>
          )}
          {order.discountCents > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-{formatPrice(order.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t font-semibold text-base">
            <span>Total Paid</span>
            <span>{formatPrice(order.totalCents)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button asChild variant="outline">
          <Link href="/my/buying/orders">View My Orders</Link>
        </Button>
        <Button asChild>
          <Link href="/">Continue Shopping</Link>
        </Button>
      </div>
    </div>
  );
}
