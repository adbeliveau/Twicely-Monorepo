import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';

interface CartIconProps {
  itemCount: number;
}

export function CartIcon({ itemCount }: CartIconProps) {
  return (
    <Link
      href="/cart"
      aria-label={itemCount > 0 ? `Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Cart'}
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100 transition-colors dark:hover:bg-gray-800"
    >
      <ShoppingBag className="h-5 w-5 text-gray-700 dark:text-gray-300" aria-hidden="true" />
      {itemCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold leading-none text-white"
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  );
}
