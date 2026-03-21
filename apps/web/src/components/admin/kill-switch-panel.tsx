'use client';

/**
 * Kill Switch Panel (G10.4 + I16)
 * Renders kill.* feature flags as interactive cards with confirmation dialogs.
 * Toggling OFF requires a destructive confirmation; toggling ON requires a lighter one.
 * I16: adds links to /flags/{id} detail page.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@twicely/ui/badge';
import { Switch } from '@twicely/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@twicely/ui/dialog';
import { Button } from '@twicely/ui/button';
import { AlertTriangle } from 'lucide-react';
import { toggleFeatureFlagAction } from '@/lib/actions/admin-feature-flags';
import type { FeatureFlagRow } from '@/lib/queries/admin-feature-flags';

interface KillSwitchPanelProps {
  flags: FeatureFlagRow[];
}

interface ConfirmState {
  flagId: string;
  flagName: string;
  currentEnabled: boolean;
}

export function KillSwitchPanel({ flags }: KillSwitchPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  function requestToggle(flag: FeatureFlagRow) {
    setConfirm({ flagId: flag.id, flagName: flag.name, currentEnabled: flag.enabled });
  }

  function handleConfirm() {
    if (!confirm) return;
    const { flagId } = confirm;
    setConfirm(null);
    startTransition(async () => {
      await toggleFeatureFlagAction({ flagId });
      router.refresh();
    });
  }

  if (flags.length === 0) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50/30 p-4">
        <p className="text-sm text-red-600">No kill switches configured.</p>
      </div>
    );
  }

  return (
    <>
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${isPending ? 'opacity-60' : ''}`}>
        {flags.map((flag) => (
          <KillSwitchCard
            key={flag.id}
            flag={flag}
            onToggle={requestToggle}
            isPending={isPending}
          />
        ))}
      </div>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {confirm?.currentEnabled ? `Disable ${confirm.flagName}?` : `Re-enable ${confirm?.flagName}?`}
            </DialogTitle>
            <DialogDescription>
              {confirm?.currentEnabled
                ? `This will immediately prevent all users from accessing this feature.`
                : `This will restore access to this feature for all users.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button
              variant={confirm?.currentEnabled ? 'destructive' : 'default'}
              onClick={handleConfirm}
            >
              {confirm?.currentEnabled ? 'Disable feature' : 'Re-enable feature'}
            </Button>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface KillSwitchCardProps {
  flag: FeatureFlagRow;
  onToggle: (flag: FeatureFlagRow) => void;
  isPending: boolean;
}

function KillSwitchCard({ flag, onToggle, isPending }: KillSwitchCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        flag.enabled
          ? 'border-green-200 bg-white'
          : 'border-red-300 bg-red-50'
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
          onCheckedChange={() => onToggle(flag)}
          disabled={isPending}
          aria-label={`Toggle ${flag.name}`}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Badge
          variant={flag.enabled ? 'default' : 'destructive'}
          className="text-xs"
        >
          {flag.enabled ? 'ACTIVE' : 'KILLED'}
        </Badge>
        <span className="text-xs text-gray-400">
          {flag.updatedAt.toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
