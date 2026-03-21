'use client';

/**
 * CrosslistPanel — "Also list on" panel with platform checkboxes and publish controls.
 * Source: F3 install prompt §3.8; Feature Lock-in Section 46
 */

import { useState } from 'react';
import { Checkbox } from '@twicely/ui/checkbox';
import { Button } from '@twicely/ui/button';
import { Badge } from '@twicely/ui/badge';
import Link from 'next/link';
import { PublishMeter } from './publish-meter';
import { PublishDialog } from './publish-dialog';
import { CHANNEL_REGISTRY } from '@twicely/crosslister/channel-registry';
import type { CrosslisterAccount } from '@twicely/crosslister/db-types';
import type { ExternalChannel } from '@twicely/crosslister/types';
import type { PublishAllowance } from '@twicely/crosslister/services/publish-meter';

interface CrosslistPanelProps {
  connectedAccounts: CrosslisterAccount[];
  publishAllowance: PublishAllowance;
  listerTier: string;
  selectedListingIds: string[];
  onPublish: (channels: ExternalChannel[]) => void;
}

export function CrosslistPanel({
  connectedAccounts,
  publishAllowance,
  listerTier,
  selectedListingIds,
  onPublish,
}: CrosslistPanelProps) {
  const [selectedChannels, setSelectedChannels] = useState<Set<ExternalChannel>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const allChannels = Array.from(CHANNEL_REGISTRY.values()).filter((m) => m.enabled);
  const connectedMap = new Map(connectedAccounts.map((a) => [a.channel as ExternalChannel, a]));

  // Non-subscriber: grayed out upsell panel
  if (listerTier === 'NONE') {
    return (
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="font-semibold mb-2 text-muted-foreground">Also list on</h3>
        <div className="flex flex-wrap gap-2 opacity-35 mb-3">
          {allChannels.map((meta) => (
            <Badge key={meta.channel} variant="outline">{meta.displayName}</Badge>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          List on eBay, Poshmark, Mercari and more.{' '}
          <Link href="/my/selling/subscription" className="text-primary underline-offset-4 hover:underline">
            Upgrade to Crosslister
          </Link>
        </p>
      </div>
    );
  }

  function toggleChannel(channel: ExternalChannel) {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  }

  function handlePublishClick() {
    if (selectedChannels.size === 0 || selectedListingIds.length === 0) return;
    setDialogOpen(true);
  }

  function handlePublished() {
    onPublish(Array.from(selectedChannels));
    setSelectedChannels(new Set());
    setDialogOpen(false);
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Also list on</h3>
        <Badge variant="secondary">{tierLabel(listerTier)}</Badge>
      </div>

      <div className="space-y-2">
        {allChannels.map((meta) => {
          const channel = meta.channel as ExternalChannel;
          const account = connectedMap.get(channel);
          const isConnected = !!account;
          const canPublish = isConnected && meta.defaultCapabilities.canPublish;

          if (!isConnected) {
            return (
              <div key={channel} className="flex items-center gap-2 opacity-50">
                <Checkbox id={`ch-${channel}`} disabled />
                <label htmlFor={`ch-${channel}`} className="text-sm flex-1">{meta.displayName}</label>
                <Link href="/my/selling/crosslist/connect" className="text-xs text-primary hover:underline">Connect</Link>
              </div>
            );
          }

          return (
            <div key={channel} className="flex items-center gap-2">
              <Checkbox
                id={`ch-${channel}`}
                checked={selectedChannels.has(channel)}
                onCheckedChange={() => toggleChannel(channel)}
                disabled={!canPublish}
              />
              <label htmlFor={`ch-${channel}`} className="text-sm flex-1 cursor-pointer">{meta.displayName}</label>
              <span className="text-xs text-green-600">Ready</span>
            </div>
          );
        })}
      </div>

      <PublishMeter allowance={publishAllowance} />

      {selectedChannels.size > 0 && selectedListingIds.length > 0 && (
        <Button size="sm" onClick={handlePublishClick} className="w-full">
          Publish to {selectedChannels.size} platform{selectedChannels.size !== 1 ? 's' : ''}
        </Button>
      )}

      <PublishDialog
        listingIds={selectedListingIds}
        channels={Array.from(selectedChannels)}
        allowance={publishAllowance}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onPublished={handlePublished}
      />
    </div>
  );
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'FREE': return 'Crosslister Free';
    case 'LITE': return 'Crosslister Lite';
    case 'PRO':  return 'Crosslister Pro';
    default:     return 'No Crosslister';
  }
}
