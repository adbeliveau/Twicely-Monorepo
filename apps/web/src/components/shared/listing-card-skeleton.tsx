import { Skeleton } from '@twicely/ui/skeleton';

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Image skeleton */}
      <Skeleton className="aspect-square w-full" />

      {/* Content skeleton */}
      <div className="p-3">
        {/* Title - 2 lines */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/4" />

        {/* Price */}
        <Skeleton className="mt-2 h-5 w-20" />

        {/* Condition badge */}
        <Skeleton className="mt-2 h-5 w-16" />

        {/* Seller */}
        <Skeleton className="mt-2 h-3 w-24" />
      </div>
    </div>
  );
}

interface ListingGridSkeletonProps {
  count?: number;
}

export function ListingGridSkeleton({ count = 8 }: ListingGridSkeletonProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}
