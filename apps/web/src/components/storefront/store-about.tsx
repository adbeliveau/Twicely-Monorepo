'use client';

import DOMPurify from 'dompurify';
import { Shield, Truck, Calendar, Star } from 'lucide-react';
import { SocialLinks } from './social-links';
import type { StorefrontSeller, StorefrontStats } from '@/lib/queries/storefront';

interface StoreAboutProps {
  seller: StorefrontSeller;
  stats: StorefrontStats;
}

export function StoreAbout({ seller, stats }: StoreAboutProps) {
  const memberYear = seller.memberSince.getFullYear();
  const hasSocialLinks = Object.keys(seller.branding.socialLinks).length > 0;

  return (
    <div className="space-y-6">
      {/* About HTML */}
      {seller.branding.aboutHtml ? (
        <div
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(seller.branding.aboutHtml) }}
        />
      ) : (
        <p className="text-gray-500">This seller hasn&apos;t added an about section yet.</p>
      )}

      {/* Store Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4" />
            <span className="text-xs">Member Since</span>
          </div>
          <p className="mt-1 font-semibold text-gray-900">{memberYear}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center gap-2 text-gray-600">
            <Shield className="h-4 w-4" />
            <span className="text-xs">Performance</span>
          </div>
          <p className="mt-1 font-semibold text-gray-900 capitalize">
            {seller.performanceBand.toLowerCase().replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Return Policy */}
      {seller.returnPolicy && (
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <Truck className="h-4 w-4" />
            <h3 className="font-medium">Return Policy</h3>
          </div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{seller.returnPolicy}</p>
        </div>
      )}

      {/* Social Links */}
      {hasSocialLinks && (
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Connect with {seller.storeName ?? 'this seller'}</h3>
          <SocialLinks links={seller.branding.socialLinks} />
        </div>
      )}

      {/* Stats */}
      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Store Stats</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Listings</p>
            <p className="font-medium text-gray-900">{stats.listingCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Followers</p>
            <p className="font-medium text-gray-900">{stats.followerCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Rating</p>
            <p className="font-medium text-gray-900">
              {stats.averageRating ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-current text-amber-500" strokeWidth={0} />
                  {stats.averageRating.toFixed(1)} ({stats.totalReviews})
                </span>
              ) : 'No reviews yet'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Member since</p>
            <p className="font-medium text-gray-900">{memberYear}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
