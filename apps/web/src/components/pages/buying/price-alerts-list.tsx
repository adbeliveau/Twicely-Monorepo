'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Bell, DollarSign, Percent, Package } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { Badge } from '@twicely/ui/badge';
import { deletePriceAlertAction } from '@/lib/actions/price-alerts';
import { formatPrice, formatDate } from '@twicely/utils/format';
import type { PriceAlertWithListing } from '@/lib/queries/price-alerts';

interface PriceAlertsListProps {
  alerts: PriceAlertWithListing[];
}

function getAlertIcon(alertType: string) {
  switch (alertType) {
    case 'TARGET_PRICE':
      return <DollarSign className="h-4 w-4" />;
    case 'PERCENT_DROP':
      return <Percent className="h-4 w-4" />;
    case 'BACK_IN_STOCK':
      return <Package className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

function getAlertDescription(alert: PriceAlertWithListing): string {
  switch (alert.alertType) {
    case 'ANY_DROP':
      return 'Any price drop';
    case 'TARGET_PRICE':
      return `Price drops to ${formatPrice(alert.targetPriceCents ?? 0)}`;
    case 'PERCENT_DROP':
      return `Price drops by ${alert.percentDrop}%`;
    case 'BACK_IN_STOCK':
      return 'Item becomes available';
    default:
      return 'Alert';
  }
}

function getStatusBadge(alert: PriceAlertWithListing) {
  if (alert.lastTriggeredAt) {
    return <Badge variant="secondary">Triggered</Badge>;
  }
  if (alert.expiresAt && new Date(alert.expiresAt) < new Date()) {
    return <Badge variant="outline">Expired</Badge>;
  }
  if (!alert.isActive) {
    return <Badge variant="outline">Inactive</Badge>;
  }
  return <Badge variant="default">Active</Badge>;
}

export function PriceAlertsList({ alerts: initialAlerts }: PriceAlertsListProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (alertId: string) => {
    setDeletingId(alertId);
    // Optimistic removal
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));

    startTransition(async () => {
      const result = await deletePriceAlertAction(alertId);
      if (!result.success) {
        // Revert on error
        const removedAlert = initialAlerts.find((a) => a.id === alertId);
        if (removedAlert) {
          setAlerts((prev) =>
            [...prev, removedAlert].sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
            )
          );
        }
      }
      setDeletingId(null);
    });
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center gap-4 rounded-lg border bg-white p-4"
        >
          {/* Listing thumbnail */}
          <Link href={`/i/${alert.listing.slug}`} className="shrink-0">
            {alert.listing.imageUrl ? (
              <Image
                src={alert.listing.imageUrl}
                alt={alert.listing.title ?? 'Listing'}
                width={64}
                height={64}
                className="rounded-md object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </Link>

          {/* Alert info */}
          <div className="flex-1 min-w-0">
            <Link
              href={`/i/${alert.listing.slug}`}
              className="font-medium hover:underline line-clamp-1"
            >
              {alert.listing.title ?? 'Untitled listing'}
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              {getAlertIcon(alert.alertType)}
              <span>{getAlertDescription(alert)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm">
                Current: {formatPrice(alert.listing.priceCents ?? 0)}
              </span>
              {getStatusBadge(alert)}
            </div>
          </div>

          {/* Date and delete */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted-foreground hidden sm:block">
              Set {formatDate(alert.createdAt, 'short')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(alert.id)}
              disabled={isPending && deletingId === alert.id}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete alert</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
