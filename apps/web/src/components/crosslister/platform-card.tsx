'use client';

/**
 * Connected platform status card.
 * Source: F1.3 install prompt §2.9 Page 1
 */

import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { Badge } from '@twicely/ui/badge';
import { RefreshCw, Download, Unplug } from 'lucide-react';
import type { CrosslisterAccount } from '@twicely/crosslister/db-types';
import { disconnectAccount } from '@/lib/actions/crosslister-accounts';
import { getChannelMetadata } from '@twicely/crosslister/channel-registry';
import { useTransition } from 'react';
import type { ExternalChannel } from '@twicely/crosslister/types';

interface PlatformCardProps {
  account: CrosslisterAccount & { activeListingCount: number };
  onImportClick: (accountId: string) => void;
  onDisconnected: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Connected',
  REAUTHENTICATION_REQUIRED: 'Reconnect required',
  REVOKED: 'Disconnected',
  ERROR: 'Error',
  PAUSED: 'Paused',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  REAUTHENTICATION_REQUIRED: 'secondary',
  REVOKED: 'outline',
  ERROR: 'destructive',
  PAUSED: 'outline',
};

export function PlatformCard({ account, onImportClick, onDisconnected }: PlatformCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleDisconnect = () => {
    startTransition(async () => {
      const result = await disconnectAccount({ accountId: account.id });
      if (result.success) onDisconnected();
    });
  };

  const canImport = account.firstImportCompletedAt === null && account.status === 'ACTIVE';
  const statusLabel = STATUS_LABELS[account.status] ?? account.status;
  const statusVariant = STATUS_VARIANTS[account.status] ?? 'outline';

  const channelMeta = (() => {
    try {
      return getChannelMetadata(account.channel as ExternalChannel);
    } catch {
      return null;
    }
  })();
  const platformColor = channelMeta?.color ?? '#888888';
  const platformName = channelMeta?.displayName ?? account.channel;

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: platformColor }}
          >
            <RefreshCw className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-medium text-sm">
              {platformName}
            </p>
            {account.externalUsername && (
              <p className="text-xs text-muted-foreground">{account.externalUsername}</p>
            )}
          </div>
        </div>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span>{account.activeListingCount} active listings</span>
        {account.lastSyncAt && (
          <span>Last sync: {new Date(account.lastSyncAt).toLocaleDateString()}</span>
        )}
      </div>

      <div className="flex gap-2">
        {canImport && (
          <Button
            size="sm"
            onClick={() => onImportClick(account.id)}
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            Import
          </Button>
        )}
        {account.status === 'REAUTHENTICATION_REQUIRED' && (
          <Button size="sm" variant="secondary" asChild>
            <Link href="/my/selling/crosslist/connect">Reconnect</Link>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleDisconnect}
          disabled={isPending}
          className="flex items-center gap-1 ml-auto"
        >
          <Unplug className="h-4 w-4" />
          {isPending ? 'Disconnecting...' : 'Disconnect'}
        </Button>
      </div>
    </div>
  );
}
