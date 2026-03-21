'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Trash2, Bell } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { deleteCategoryAlertAction } from '@/lib/actions/category-alerts';
import type { CategoryAlert } from '@/lib/queries/category-alerts';

interface AlertsListProps {
  alerts: CategoryAlert[];
}

export function AlertsList({ alerts: initialAlerts }: AlertsListProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (alertId: string) => {
    setDeletingId(alertId);
    // Optimistic removal
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));

    startTransition(async () => {
      const result = await deleteCategoryAlertAction(alertId);
      if (!result.success) {
        // Revert on error
        const removedAlert = initialAlerts.find((a) => a.id === alertId);
        if (removedAlert) {
          setAlerts((prev) => [...prev, removedAlert].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          ));
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
          className="flex items-center justify-between rounded-lg border bg-white p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Link
                href={`/c/${alert.categorySlug}`}
                className="font-medium hover:underline"
              >
                {alert.filters.categoryName ?? alert.categoryId}
              </Link>
              <p className="text-sm text-muted-foreground">
                {alert.isActive ? 'Notifications on' : 'Notifications off'}
              </p>
            </div>
          </div>
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
      ))}
    </div>
  );
}
