import { RisingSellerCard } from './rising-seller-card';
import type { RisingSellerData } from '@/lib/queries/explore';

interface Props {
  sellers: RisingSellerData[];
}

/**
 * Horizontal scrollable row of rising seller cards.
 * Per Personalization Canonical §5 — Rising Sellers section.
 */
export function RisingSellersRow({ sellers }: Props) {
  if (sellers.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 pb-2">
        {sellers.map((seller) => (
          <RisingSellerCard key={seller.userId} seller={seller} />
        ))}
      </div>
    </div>
  );
}
