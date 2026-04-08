'use client';

/**
 * Grid of platforms with connect buttons — 11 supported marketplaces.
 * Source: F1.3 install prompt §2.9 Page 2; F2 install prompt §2.0.5
 *
 * Each card shows a branded hero area (brand color + white logo) on top
 * and a white footer with the connect button on the bottom.
 * OAuth channels redirect to the marketplace's auth URL.
 * Session channels open the SessionAuthDialog for cookie-based auth.
 */

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { connectPlatformAccount } from '@/lib/actions/crosslister-accounts';
import { SessionAuthDialog } from './session-auth-dialog';
import { PLATFORM_LOGOS } from './platform-logos';
import type { ExternalChannel } from '@twicely/crosslister/types';

interface Platform {
  key: ExternalChannel;
  name: string;
  color: string;
  authMethod: 'OAUTH' | 'SESSION';
}

const PLATFORMS: Platform[] = [
  { key: 'EBAY',           name: 'eBay',             color: '#E53238', authMethod: 'OAUTH' },
  { key: 'ETSY',           name: 'Etsy',             color: '#F16521', authMethod: 'OAUTH' },
  { key: 'SHOPIFY',        name: 'Shopify',          color: '#96BF48', authMethod: 'OAUTH' },
  { key: 'WHATNOT',        name: 'Whatnot',          color: '#FFDE00', authMethod: 'OAUTH' },
  { key: 'GRAILED',        name: 'Grailed',          color: '#000000', authMethod: 'OAUTH' },
  { key: 'DEPOP',          name: 'Depop',            color: '#FF0000', authMethod: 'OAUTH' },
  { key: 'MERCARI',        name: 'Mercari',          color: '#FF4F00', authMethod: 'OAUTH' },
  { key: 'FB_MARKETPLACE', name: 'Facebook Marketplace', color: '#1877F2', authMethod: 'OAUTH' },
  { key: 'POSHMARK',       name: 'Poshmark',         color: '#702F8A', authMethod: 'SESSION' },
  { key: 'THEREALREAL',    name: 'The RealReal',     color: '#000000', authMethod: 'SESSION' },
  { key: 'VESTIAIRE',      name: 'Vestiaire Collective', color: '#000000', authMethod: 'SESSION' },
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PLATFORMS.map((platform) => {
          const isThisPending = isPending && pendingChannel === platform.key;
          const Logo = PLATFORM_LOGOS[platform.key];
          return (
            <div
              key={platform.key}
              className="rounded-lg border bg-card overflow-hidden flex flex-col transition-transform hover:scale-[1.02] hover:shadow-md"
            >
              <div
                className="flex items-center justify-center h-32 text-white"
                style={{ backgroundColor: platform.color }}
              >
                <Logo className="h-14 w-auto max-w-[80%]" />
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{platform.name}</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {platform.authMethod === 'OAUTH' ? 'OAuth' : 'Session'}
                  </span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleConnect(platform)}
                  disabled={isPending}
                  size="sm"
                >
                  {isThisPending ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
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
