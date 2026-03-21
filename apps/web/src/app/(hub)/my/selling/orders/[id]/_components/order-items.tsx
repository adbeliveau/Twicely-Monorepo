import Image from 'next/image';
import { formatPrice } from '@twicely/utils/format';
import { Package } from 'lucide-react';

interface OrderItem {
  id: string;
  listingId: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  imageUrl: string | null;
}

export function OrderItems({ items }: { items: OrderItem[] }) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="font-semibold mb-4">Order Items</h2>
      <div className="divide-y">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
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
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">
                {formatPrice(item.unitPriceCents * item.quantity)}
              </p>
              <p className="text-sm text-gray-500">
                {formatPrice(item.unitPriceCents)} each
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
