'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, Clock } from 'lucide-react';
import { formatDate } from '@twicely/utils/format';
import { Button } from '@twicely/ui/button';

interface BuyerReviewCardProps {
  review: {
    id: string;
    orderId: string;
    rating: number;
    title: string | null;
    body: string | null;
    createdAt: Date;
    canEdit: boolean;
    hoursUntilEditExpires: number | null;
    sellerName: string;
    listingTitle: string | null;
    listingSlug: string | null;
    response: { body: string; createdAt: Date } | null;
  };
}

const MAX_BODY_LENGTH = 200;

/**
 * Compact review card for "My Reviews" page.
 *
 * Shows listing + seller context, edit controls, and seller response preview.
 * Optimized for buyer's own review list (no reviewer name shown).
 */
export function BuyerReviewCard({ review }: BuyerReviewCardProps) {
  const [expanded, setExpanded] = useState(false);

  const needsTruncation = (review.body?.length ?? 0) > MAX_BODY_LENGTH;
  const displayBody = expanded || !needsTruncation
    ? review.body
    : review.body?.slice(0, MAX_BODY_LENGTH) + '...';

  return (
    <div className="rounded-lg border bg-white p-6 space-y-4">
      {/* Header: Rating + Date + Edit Badge */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          {/* Star Rating */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= review.rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-none text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-gray-500">{formatDate(review.createdAt)}</span>
          </div>

          {/* Listing + Seller */}
          <div className="text-sm text-gray-600">
            {review.listingTitle && review.listingSlug ? (
              <Link
                href={`/i/${review.listingSlug}`}
                className="font-medium text-gray-900 hover:text-primary"
              >
                {review.listingTitle}
              </Link>
            ) : (
              <span className="font-medium text-gray-900">Listing unavailable</span>
            )}
            {' · '}
            <span>Seller: {review.sellerName}</span>
          </div>
        </div>

        {/* Edit Badge/Button */}
        {review.canEdit && review.hoursUntilEditExpires && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              <Clock className="h-3 w-3" />
              <span>{review.hoursUntilEditExpires}h left</span>
            </div>
            <Link href={`/my/buying/orders/${review.orderId}/review`}>
              <Button size="sm" variant="outline">
                Edit
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Review Content */}
      <div className="space-y-2">
        {review.title && <p className="font-semibold text-gray-900">{review.title}</p>}

        {review.body && (
          <div className="space-y-1">
            <p className="text-gray-700 whitespace-pre-wrap">{displayBody}</p>
            {needsTruncation && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-sm text-primary hover:text-primary/80"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Seller Response */}
      {review.response && (
        <div className="ml-4 pl-4 border-l-2 border-gray-200 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Seller Response</span>
            <span className="text-xs text-gray-500">{formatDate(review.response.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.response.body}</p>
        </div>
      )}
    </div>
  );
}
