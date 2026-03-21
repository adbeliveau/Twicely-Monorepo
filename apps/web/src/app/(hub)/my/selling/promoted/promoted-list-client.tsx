'use client';

/**
 * D2.4: Promoted Listings Client Component
 */

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@twicely/ui/tabs';
import { Button } from '@twicely/ui/button';
import { formatPrice } from '@twicely/utils/format';
import { deactivateBoost } from '@/lib/actions/boosting';
import type { PromotedListingRow } from '@/lib/queries/boosting';
import { Loader2, Rocket } from 'lucide-react';

interface PromotedListClientProps {
  promotedListings: PromotedListingRow[];
}

type TabValue = 'active' | 'ended';

export function PromotedListClient({ promotedListings }: PromotedListClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<TabValue>('active');

  const activeListings = promotedListings.filter((p) => p.isActive);
  const endedListings = promotedListings.filter((p) => !p.isActive);
  const displayedListings = tab === 'active' ? activeListings : endedListings;

  function handleDeactivate(listingId: string) {
    startTransition(async () => {
      await deactivateBoost({ listingId });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="active">Active ({activeListings.length})</TabsTrigger>
          <TabsTrigger value="ended">Ended ({endedListings.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {displayedListings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Rocket className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            {tab === 'active'
              ? 'No active promoted listings. Boost listings to appear higher in search results.'
              : 'No ended promotions yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={isPending}>
          {displayedListings.map((promo) => (
            <div key={promo.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{promo.listingId}</span>
                <span className="text-sm bg-primary/10 px-2 py-0.5 rounded">{promo.boostPercent}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>Impressions: {promo.impressions.toLocaleString()}</div>
                <div>Clicks: {promo.clicks.toLocaleString()}</div>
                <div>Sales: {promo.sales}</div>
                <div>Fees: {formatPrice(promo.totalFeeCents)}</div>
              </div>
              {promo.isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDeactivate(promo.listingId)}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Deactivate
                </Button>
              )}
              {!promo.isActive && promo.endedAt && (
                <p className="text-xs text-muted-foreground">
                  Ended {new Date(promo.endedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
