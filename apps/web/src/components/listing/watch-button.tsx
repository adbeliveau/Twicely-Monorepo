'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Bell, BellOff } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { toggleWatchlistAction, togglePriceAlertAction } from '@/lib/actions/watchlist';
import { cn } from '@twicely/utils';

interface WatchButtonProps {
  listingId: string;
  listingSlug: string;
  initialWatching: boolean;
  initialNotifyPriceDrop?: boolean;
  watcherCount: number;
  isLoggedIn: boolean;
  autoWatch?: boolean;
  disabled?: boolean;
}

export function WatchButton({
  listingId,
  listingSlug,
  initialWatching,
  initialNotifyPriceDrop = true,
  watcherCount,
  isLoggedIn,
  autoWatch = false,
  disabled = false,
}: WatchButtonProps) {
  const router = useRouter();
  const [watching, setWatching] = useState(initialWatching);
  const [notifyPriceDrop, setNotifyPriceDrop] = useState(initialNotifyPriceDrop);
  const [count, setCount] = useState(watcherCount);
  const [isPending, startTransition] = useTransition();
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Auto-watch on mount if redirected back from login
  useEffect(() => {
    if (autoWatch && isLoggedIn && !initialWatching) {
      handleToggleWatch();
      // Clean URL
      router.replace(`/i/${listingSlug}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleWatch = () => {
    if (!isLoggedIn) {
      router.push(`/auth/login?callbackUrl=/i/${listingSlug}?action=watch`);
      return;
    }
    const wasWatching = watching;
    setWatching(!wasWatching);
    setCount((prev) => (wasWatching ? prev - 1 : prev + 1));
    if (!wasWatching) {
      setNotifyPriceDrop(true);
    }

    startTransition(async () => {
      const result = await toggleWatchlistAction(listingId);
      if (!result.success) {
        setWatching(wasWatching);
        setCount((prev) => (wasWatching ? prev + 1 : prev - 1));
      } else if (!wasWatching) {
        // Show confirmation when adding to watchlist
        setShowConfirmation(true);
        setTimeout(() => setShowConfirmation(false), 2000);
      }
    });
  };

  const handleToggleAlert = () => {
    const wasNotifying = notifyPriceDrop;
    setNotifyPriceDrop(!wasNotifying);

    startTransition(async () => {
      const result = await togglePriceAlertAction(listingId);
      if (!result.success) {
        setNotifyPriceDrop(wasNotifying);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggleWatch}
        disabled={disabled || isPending}
        className={cn(watching && 'text-red-500 border-red-200 hover:text-red-600')}
      >
        <Heart className={cn('h-4 w-4 mr-1', watching && 'fill-current')} />
        {watching ? 'Watching' : 'Watch'}
      </Button>
      {watching && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleAlert}
          disabled={disabled || isPending}
          title={notifyPriceDrop ? 'Price alerts on' : 'Price alerts off'}
          className={cn(notifyPriceDrop ? 'text-primary' : 'text-muted-foreground')}
        >
          {notifyPriceDrop ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </Button>
      )}
      {count > 0 && (
        <span className="text-sm text-muted-foreground">
          {count} watching
        </span>
      )}
      {showConfirmation && (
        <span className="text-sm text-green-600 font-medium">
          Added to watchlist!
        </span>
      )}
    </div>
  );
}
