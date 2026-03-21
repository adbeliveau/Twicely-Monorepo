'use client';

/**
 * Grid of platforms with connect buttons.
 * Source: F1.3 install prompt §2.9 Page 2; F2 install prompt §2.0.5
 *
 * F2: eBay, Poshmark, and Mercari are all connectable.
 * OAuth channels redirect via URL. Session channels show the SessionAuthDialog.
 */

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { RefreshCw } from 'lucide-react';
import { connectPlatformAccount } from '@/lib/actions/crosslister-accounts';
import { SessionAuthDialog } from './session-auth-dialog';
import type { ExternalChannel } from '@twicely/crosslister/types';

interface Platform {
  key: ExternalChannel;
  name: string;
  color: string;
  authMethod: 'OAUTH' | 'SESSION';
}

const PLATFORMS: Platform[] = [
  { key: 'EBAY', name: 'eBay', color: '#E53238', authMethod: 'OAUTH' },
  { key: 'POSHMARK', name: 'Poshmark', color: '#DE3163', authMethod: 'SESSION' },
  { key: 'MERCARI', name: 'Mercari', color: '#FF4F00', authMethod: 'OAUTH' },
];

interface ConnectPlatformGridProps {
  onConnected?: () => void;
}

export function ConnectPlatformGrid({ onConnected }: ConnectPlatformGridProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingChannel, setPendingChannel] = useState<ExternalChannel | null>(null);
  const [sessionDialogChannel, setSessionDialogChannel] = useState<Platform | null>(null);

  const handleConnect = (platform: Platform) => {
    setPendingChannel(platform.key);
    startTransition(async () => {
      const result = await connectPlatformAccount({ channel: platform.key });

      if (!result.success) {
        setPendingChannel(null);
        return;
      }

      if (result.data?.method === 'OAUTH' && result.data.url) {
        window.location.href = result.data.url;
        return;
      }

      if (result.data?.method === 'SESSION') {
        setSessionDialogChannel(platform);
        setPendingChannel(null);
        return;
      }

      setPendingChannel(null);
    });
  };

  const handleAuthenticated = () => {
    setSessionDialogChannel(null);
    onConnected?.();
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const isThisPending = isPending && pendingChannel === platform.key;
          return (
            <div key={platform.key} className="rounded-lg border bg-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: platform.color }}
                >
                  <RefreshCw className="h-5 w-5 text-white" />
                </div>
                <p className="font-medium text-sm">{platform.name}</p>
              </div>
              <Button
                className="w-full"
                onClick={() => handleConnect(platform)}
                disabled={isPending}
              >
                {isThisPending ? 'Connecting...' : `Connect ${platform.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      {sessionDialogChannel && (
        <SessionAuthDialog
          channel={sessionDialogChannel.key}
          channelDisplayName={sessionDialogChannel.name}
          channelColor={sessionDialogChannel.color}
          open={sessionDialogChannel !== null}
          onOpenChange={(open) => {
            if (!open) setSessionDialogChannel(null);
          }}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </>
  );
}
