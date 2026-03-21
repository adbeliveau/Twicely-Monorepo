'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, Check } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@twicely/ui/dropdown-menu';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import {
  createPriceAlertAction,
  deletePriceAlertAction,
  type PriceAlertType,
} from '@/lib/actions/price-alerts';
import { formatPrice } from '@twicely/utils/format';
import { cn } from '@twicely/utils';

interface PriceAlertButtonProps {
  listingId: string;
  listingSlug: string;
  currentPriceCents: number;
  listingStatus: string;
  isLoggedIn: boolean;
  existingAlert?: {
    alertId: string;
    alertType: PriceAlertType;
    targetPriceCents?: number;
    percentDrop?: number;
  } | null;
}

export function PriceAlertButton({
  listingId,
  listingSlug,
  currentPriceCents,
  listingStatus,
  isLoggedIn,
  existingAlert,
}: PriceAlertButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [alert, setAlert] = useState(existingAlert ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const [showTargetInput, setShowTargetInput] = useState(false);
  const [showPercentInput, setShowPercentInput] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [percentDrop, setPercentDrop] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isUnavailable = listingStatus === 'SOLD' || listingStatus === 'ENDED';

  const handleSetAlert = (alertType: PriceAlertType) => {
    if (!isLoggedIn) {
      router.push(`/auth/login?callbackUrl=/i/${listingSlug}`);
      return;
    }

    setError(null);

    if (alertType === 'TARGET_PRICE') {
      setShowTargetInput(true);
      setShowPercentInput(false);
      return;
    }

    if (alertType === 'PERCENT_DROP') {
      setShowPercentInput(true);
      setShowTargetInput(false);
      return;
    }

    // ANY_DROP or BACK_IN_STOCK - create immediately
    startTransition(async () => {
      const result = await createPriceAlertAction({ listingId, alertType });
      if (result.success && result.alertId) {
        setAlert({ alertId: result.alertId, alertType });
        setIsOpen(false);
      } else {
        setError(result.error ?? 'Failed to create alert');
      }
    });
  };

  const handleSubmitTargetPrice = () => {
    const cents = Math.round(parseFloat(targetPrice) * 100);
    if (isNaN(cents) || cents <= 0) {
      setError('Enter a valid price');
      return;
    }
    if (cents >= currentPriceCents) {
      setError('Target must be below current price');
      return;
    }

    startTransition(async () => {
      const result = await createPriceAlertAction({
        listingId,
        alertType: 'TARGET_PRICE',
        targetPriceCents: cents,
      });
      if (result.success && result.alertId) {
        setAlert({ alertId: result.alertId, alertType: 'TARGET_PRICE', targetPriceCents: cents });
        setShowTargetInput(false);
        setTargetPrice('');
        setIsOpen(false);
      } else {
        setError(result.error ?? 'Failed to create alert');
      }
    });
  };

  const handleSubmitPercentDrop = () => {
    const percent = parseFloat(percentDrop);
    if (isNaN(percent) || percent < 5 || percent > 50) {
      setError('Enter a percentage between 5% and 50%');
      return;
    }

    startTransition(async () => {
      const result = await createPriceAlertAction({
        listingId,
        alertType: 'PERCENT_DROP',
        targetPercentDrop: percent,
      });
      if (result.success && result.alertId) {
        setAlert({ alertId: result.alertId, alertType: 'PERCENT_DROP', percentDrop: percent });
        setShowPercentInput(false);
        setPercentDrop('');
        setIsOpen(false);
      } else {
        setError(result.error ?? 'Failed to create alert');
      }
    });
  };

  const handleRemoveAlert = () => {
    if (!alert) return;

    startTransition(async () => {
      const result = await deletePriceAlertAction(alert.alertId);
      if (result.success) {
        setAlert(null);
      } else {
        setError(result.error ?? 'Failed to remove alert');
      }
    });
  };

  const getAlertLabel = (): string => {
    if (!alert) return '';
    switch (alert.alertType) {
      case 'ANY_DROP':
        return 'Any price drop';
      case 'TARGET_PRICE':
        return `Below ${formatPrice(alert.targetPriceCents ?? 0)}`;
      case 'PERCENT_DROP':
        return `${alert.percentDrop}% off`;
      case 'BACK_IN_STOCK':
        return 'Back in stock';
      default:
        return 'Alert set';
    }
  };

  // If alert exists, show pill with remove option
  if (alert) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm',
            'bg-primary/10 text-primary'
          )}
        >
          <Bell className="h-3.5 w-3.5" />
          <span>{getAlertLabel()}</span>
          <button
            type="button"
            onClick={handleRemoveAlert}
            disabled={isPending}
            className="ml-1 rounded-full p-0.5 hover:bg-primary/20"
            aria-label="Remove alert"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          <Bell className="mr-1.5 h-4 w-4" />
          Set Alert
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {error && (
          <div className="px-2 py-1.5 text-sm text-destructive">{error}</div>
        )}

        {showTargetInput ? (
          <div className="p-2 space-y-2">
            <Label htmlFor="target-price" className="text-sm">
              Alert when price drops to:
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="target-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(currentPriceCents / 100 - 0.01).toFixed(2)}
                  placeholder={(currentPriceCents / 100 * 0.9).toFixed(2)}
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="pl-6"
                  autoFocus
                />
              </div>
              <Button size="sm" onClick={handleSubmitTargetPrice} disabled={isPending}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Current: {formatPrice(currentPriceCents)}
            </p>
          </div>
        ) : showPercentInput ? (
          <div className="p-2 space-y-2">
            <Label htmlFor="percent-drop" className="text-sm">
              Alert when price drops by:
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="percent-drop"
                  type="number"
                  min="5"
                  max="50"
                  placeholder="10"
                  value={percentDrop}
                  onChange={(e) => setPercentDrop(e.target.value)}
                  autoFocus
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
              <Button size="sm" onClick={handleSubmitPercentDrop} disabled={isPending}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">5% to 50%</p>
          </div>
        ) : (
          <>
            <DropdownMenuItem onClick={() => handleSetAlert('ANY_DROP')}>
              Notify me of any price drop
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSetAlert('TARGET_PRICE')}>
              Alert when price drops to $___
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSetAlert('PERCENT_DROP')}>
              Alert when price drops by ___%
            </DropdownMenuItem>
            {isUnavailable && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleSetAlert('BACK_IN_STOCK')}>
                  Notify me if this becomes available
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
