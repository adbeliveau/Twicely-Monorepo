import Link from 'next/link';
import Image from 'next/image';
import type { RisingSellerData } from '@/lib/queries/explore';

interface Props {
  seller: RisingSellerData;
}

/**
 * Card for a single rising seller.
 * Per Personalization Canonical §5 — Rising Sellers section.
 */
export function RisingSellerCard({ seller }: Props) {
  const href = seller.storeSlug ? `/st/${seller.storeSlug}` : null;
  const displayName = seller.storeName ?? 'Seller';

  const cardContent = (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center">
      <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted">
        {seller.avatarUrl ? (
          <Image
            src={seller.avatarUrl}
            alt={displayName}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium leading-tight">{displayName}</p>
        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          New seller
        </span>
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>{seller.listingCount} listings</span>
        <span>{seller.followerCount} followers</span>
      </div>
      {href && (
        <span className="text-xs font-medium text-primary underline underline-offset-4">
          View store
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block w-[180px] min-w-[180px] hover:opacity-90 transition-opacity">
        {cardContent}
      </Link>
    );
  }

  return <div className="w-[180px] min-w-[180px]">{cardContent}</div>;
}
