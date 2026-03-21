/**
 * Crosslister dashboard loading skeleton — /my/selling/crosslist
 * Suspense fallback matching the populated state layout.
 * Source: H1.4 install prompt §4 Step 5
 */

import { Skeleton } from '@twicely/ui/skeleton';

export default function CrosslisterDashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Platform cards skeleton — 3 shimmer cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>

      {/* Publish meter skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>

      {/* Queue status skeleton */}
      <Skeleton className="h-6 w-48" />

      {/* Connect more link skeleton */}
      <Skeleton className="h-4 w-36" />
    </div>
  );
}
