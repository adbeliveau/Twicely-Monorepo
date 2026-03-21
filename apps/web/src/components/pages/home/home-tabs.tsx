'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@twicely/ui/tabs';
import type { FeedData } from '@/lib/queries/feed';
import type {
  ExploreCollection,
  RisingSellerData,
} from '@/lib/queries/explore';
import type { ListingCardData } from '@/types/listings';
import { FeedPageContent } from '@/components/pages/feed/feed-page-content';
import { ExplorePageContent } from '@/components/pages/explore/explore-page-content';

interface Props {
  /** Whether the user is currently logged in */
  isAuthenticated: boolean;
  /** Feed data for "For You" tab — null when guest or no interests */
  feedData: FeedData | null;
  /** Explore data */
  exploreData: {
    trendingListings: ListingCardData[];
    staffPickCollections: ExploreCollection[];
    seasonalCollections: ExploreCollection[];
    risingSellers: RisingSellerData[];
    promotedListings: ListingCardData[];
  };
  /** Categories tab renders its children */
  categoriesContent: React.ReactNode;
}

/**
 * Homepage tab system: For You / Explore / Categories.
 * Per Personalization Canonical §5:
 *   - Guests: Explore tab only (For You hidden)
 *   - Logged in with interests: For You as default
 *   - Logged in without interests: Explore as default, For You shows CTA
 */
export function HomeTabs({
  isAuthenticated,
  feedData,
  exploreData,
  categoriesContent,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const hasInterests = feedData?.hasInterests ?? false;

  // Determine default tab
  let defaultTab: string;
  if (!isAuthenticated) {
    defaultTab = 'explore';
  } else if (hasInterests) {
    defaultTab = 'foryou';
  } else {
    defaultTab = 'explore';
  }

  const currentTab = searchParams.get('tab') ?? defaultTab;

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6">
        {isAuthenticated && (
          <TabsTrigger value="foryou">For You</TabsTrigger>
        )}
        <TabsTrigger value="explore">Explore</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
      </TabsList>

      {/* For You — authenticated users only */}
      {isAuthenticated && (
        <TabsContent value="foryou">
          {feedData ? (
            <FeedPageContent feedData={feedData} />
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground text-sm">
                Pick your interests to personalize your feed.
              </p>
              <a
                href="/my/settings"
                className="mt-3 inline-block text-sm font-medium underline underline-offset-4 hover:no-underline"
              >
                Choose interests
              </a>
            </div>
          )}
        </TabsContent>
      )}

      {/* Explore — all users */}
      <TabsContent value="explore">
        <ExplorePageContent
          trendingListings={exploreData.trendingListings}
          staffPickCollections={exploreData.staffPickCollections}
          seasonalCollections={exploreData.seasonalCollections}
          risingSellers={exploreData.risingSellers}
          promotedListings={exploreData.promotedListings}
        />
      </TabsContent>

      {/* Categories — all users */}
      <TabsContent value="categories">
        {categoriesContent}
      </TabsContent>
    </Tabs>
  );
}
