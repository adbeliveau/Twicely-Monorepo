'use client';

/**
 * Launch Gate Panel (G10.4 + I16)
 * Renders gate.* feature flags as interactive cards with a summary line.
 * Gates start closed (disabled) and are opened when a feature is ready for production.
 * I16: adds links to /flags/{id} detail page.
 */

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@twicely/ui/badge';
import { Switch } from '@twicely/ui/switch';
import { toggleFeatureFlagAction } from '@/lib/actions/admin-feature-flags';
import type { FeatureFlagRow } from '@/lib/queries/admin-feature-flags';

interface LaunchGatePanelProps {
  flags: FeatureFlagRow[];
}

export function LaunchGatePanel({ flags }: LaunchGatePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle(flagId: string) {
    startTransition(async () => {
      await toggleFeatureFlagAction({ flagId });
      router.refresh();
    });
  }

  const openCount = flags.filter((f) => f.enabled).length;
  const totalCount = flags.length;

  if (flags.length === 0) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
        <p className="text-sm text-blue-600">No launch gates configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-blue-700 font-medium">
        {openCount} of {totalCount} gates open
      </p>
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${isPending ? 'opacity-60' : ''}`}>
        {flags.map((flag) => (
          <LaunchGateCard
            key={flag.id}
            flag={flag}
            onToggle={handleToggle}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  );
}

interface LaunchGateCardProps {
  flag: FeatureFlagRow;
  onToggle: (flagId: string) => void;
  isPending: boolean;
}

function LaunchGateCard({ flag, onToggle, isPending }: LaunchGateCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        flag.enabled
          ? 'border-green-200 bg-white'
          : 'border-blue-200 bg-blue-50/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link href={`/flags/${flag.id}`} className="truncate font-semibold text-sm text-gray-900 hover:underline hover:text-blue-600 block">
            {flag.name}
          </Link>
          {flag.description && (
            <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{flag.description}</p>
          )}
        </div>
        <Switch
          checked={flag.enabled}
          onCheckedChange={() => onToggle(flag.id)}
          disabled={isPending}
          aria-label={`Toggle gate ${flag.name}`}
        />
      </div>
      <div className="mt-3">
        <Badge
          variant={flag.enabled ? 'default' : 'outline'}
          className={`text-xs ${flag.enabled ? '' : 'border-amber-400 text-amber-700 bg-amber-50'}`}
        >
          {flag.enabled ? 'OPEN' : 'CLOSED'}
        </Badge>
      </div>
    </div>
  );
}
