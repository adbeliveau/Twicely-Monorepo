'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { Store, Users, Star, Calendar, AlertTriangle, LayoutGrid, List } from 'lucide-react';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { StorefrontListings } from './storefront-listings';
import { StoreTabs } from './store-tabs';
import { StoreSocialLinks } from './store-social-links';
import { StorePolicies } from './store-policies';
import { toggleFollow } from '@/lib/actions/follow';
import { formatDate } from '@twicely/utils/format';
import type { StorefrontData } from '@/lib/queries/storefront';
import type { ListingCardData } from '@/types/listings';

interface PublicStorefrontProps {
  data: StorefrontData;
  isLoggedIn: boolean;
  isOwnStore: boolean;
  isFollowing?: boolean;
  sellerUserId?: string;
}

const BAND_LABELS: Record<string, { label: string; color: string }> = {
  POWER_SELLER: { label: 'Power Seller', color: 'bg-purple-100 text-purple-800' },
  TOP_RATED: { label: 'Top Rated', color: 'bg-yellow-100 text-yellow-800' },
  ESTABLISHED: { label: 'Established', color: 'bg-green-100 text-green-800' },
  EMERGING: { label: 'New Seller', color: 'bg-gray-100 text-gray-800' },
};

export function PublicStorefront({
  data,
  isLoggedIn,
  isOwnStore,
  isFollowing: initialIsFollowing = false,
  sellerUserId,
}: PublicStorefrontProps) {
  const { seller, stats, listings, featuredListings, customCategories } = data;
  const { branding } = seller;

  const [activeTab, setActiveTab] = useState('all');
  const [descExpanded, setDescExpanded] = useState(false);
  const [following, setFollowing] = useState(initialIsFollowing);
  const [isHoveringFollow, setIsHoveringFollow] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>(
    (branding.defaultStoreView?.toUpperCase() as 'GRID' | 'LIST') || 'GRID'
  );

  const displayName = seller.storeName ?? 'Store';
  const accent = branding.accentColor || '#7C3AED';
  const initial = displayName.charAt(0).toUpperCase();
  const bandInfo = BAND_LABELS[seller.performanceBand] ?? BAND_LABELS.EMERGING!;
  const socialLinks = branding.socialLinks ?? {};

  // Filter listings based on active tab
  const filteredListings = useMemo((): ListingCardData[] => {
    if (activeTab === 'featured') return featuredListings;
    if (activeTab === 'all') return listings;
    // Filter by custom category slug
    const category = customCategories.find((c) => c.slug === activeTab);
    if (category) {
      return listings.filter((l) => l.storefrontCategoryId === category.id);
    }
    return listings;
  }, [activeTab, listings, featuredListings, customCategories]);

  const hasFeatured = featuredListings.length > 0;
  const description = seller.storeDescription ?? '';
  const isLongDesc = description.length > 200;

  return (
    <div className="flex flex-col gap-6">
      {/* Banner + Logo */}
      <div className="relative mb-10">
        <div className="rounded-lg overflow-hidden">
          {branding.bannerUrl ? (
            <img
              src={branding.bannerUrl}
              alt={`${displayName} banner`}
              className="w-full h-[200px] object-cover"
            />
          ) : (
            <div
              className="w-full h-[120px]"
              style={{
                background: `linear-gradient(135deg, ${accent}30 0%, ${accent}10 100%)`,
              }}
            />
          )}
        </div>

        {/* Logo (overlapping banner) */}
        <div className="absolute -bottom-10 left-6">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={displayName}
              className="h-20 w-20 rounded-full border-4 border-background object-cover"
            />
          ) : (
            <div
              className="h-20 w-20 rounded-full border-4 border-background flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              {initial}
            </div>
          )}
        </div>
      </div>

      {/* Store Header */}
      <div className="px-1">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <Badge className={bandInfo.color} variant="secondary">
                {bandInfo.label}
              </Badge>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Store className="h-4 w-4" />
                <span>{stats.listingCount} listings</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{stats.followerCount} followers</span>
              </div>
              {stats.averageRating !== null && stats.totalReviews > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>
                    {stats.averageRating.toFixed(1)} ({stats.totalReviews} reviews)
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Member since {formatDate(seller.memberSince)}</span>
              </div>
            </div>

            {/* Description */}
            {description && (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">
                  {isLongDesc && !descExpanded ? `${description.slice(0, 200)}...` : description}
                </p>
                {isLongDesc && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="text-sm font-medium mt-1"
                    style={{ color: accent }}
                  >
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}

            {/* Social Links */}
            <div className="mt-3">
              <StoreSocialLinks
                instagram={socialLinks.instagram}
                youtube={socialLinks.youtube}
                tiktok={socialLinks.tiktok}
                twitter={socialLinks.twitter}
                website={socialLinks.website}
              />
            </div>
          </div>

          {/* Follow Button */}
          <div className="flex-shrink-0">
            {!isOwnStore && (
              isLoggedIn && sellerUserId ? (
                <Button
                  variant={following ? 'outline' : 'default'}
                  disabled={isPending}
                  onMouseEnter={() => setIsHoveringFollow(true)}
                  onMouseLeave={() => setIsHoveringFollow(false)}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await toggleFollow(sellerUserId);
                      if (result.success && result.isFollowing !== undefined) {
                        setFollowing(result.isFollowing);
                      }
                    });
                  }}
                  className={following && isHoveringFollow ? 'hover:bg-red-50 hover:text-red-600 hover:border-red-200' : ''}
                >
                  {following ? (isHoveringFollow ? 'Unfollow' : 'Following') : 'Follow'}
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href={`/auth/login?callbackUrl=/st/${seller.storeSlug ?? ''}`}>Follow</Link>
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Vacation Mode Warning */}
      {seller.vacationMode && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Store on Vacation</p>
            <p className="text-sm text-yellow-700">
              {seller.vacationMessage ?? 'This seller is currently on vacation and may not be responding to orders.'}
            </p>
          </div>
        </div>
      )}

      {/* Announcement Bar */}
      {branding.announcement && (
        <div
          className="rounded-md p-3 text-sm text-center"
          style={{
            backgroundColor: `${accent}15`,
            color: accent,
          }}
        >
          {branding.announcement}
        </div>
      )}

      {/* Tabs + View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 overflow-hidden">
          <StoreTabs
            categories={customCategories}
            hasFeatured={hasFeatured}
            accentColor={accent}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant={viewMode === 'GRID' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('GRID')}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'LIST' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('LIST')}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Listings */}
      <StorefrontListings
        listings={filteredListings}
        isLoggedIn={isLoggedIn}
        isOwnStore={isOwnStore}
        viewMode={viewMode}
      />

      {/* About & Return Policy */}
      <StorePolicies aboutHtml={branding.aboutHtml} returnPolicy={seller.returnPolicy} />
    </div>
  );
}
