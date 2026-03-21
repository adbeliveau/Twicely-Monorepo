'use client';

/**
 * Session auth dialog for Tier C platforms (e.g., Poshmark).
 * Prompts the seller for their platform username and password.
 * Source: F2 install prompt §2.0.6; Lister Canonical Section 9.4
 */

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@twicely/ui/dialog';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { AlertTriangle } from 'lucide-react';
import { authenticateSessionAccount } from '@/lib/actions/crosslister-accounts';
import type { ExternalChannel } from '@twicely/crosslister/types';

interface SessionAuthDialogProps {
  channel: ExternalChannel;
  channelDisplayName: string;
  channelColor: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
}

export function SessionAuthDialog({
  channel,
  channelDisplayName,
  channelColor,
  open,
  onOpenChange,
  onAuthenticated,
}: SessionAuthDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await authenticateSessionAccount({ channel, username, password });
      if (result.success) {
        setUsername('');
        setPassword('');
        onOpenChange(false);
        onAuthenticated();
      } else {
        setError(result.error ?? 'Connection failed. Please check your credentials.');
      }
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setUsername('');
      setPassword('');
      setError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: channelColor }}
            />
            <DialogTitle>Connect {channelDisplayName}</DialogTitle>
          </div>
          <DialogDescription>
            Enter your {channelDisplayName} credentials to connect your account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            Your credentials are encrypted and stored securely. Twicely never shares your
            credentials with third parties.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-username">Username</Label>
            <Input
              id="session-username"
              type="text"
              autoComplete="username"
              placeholder={`Your ${channelDisplayName} username`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-password">Password</Label>
            <Input
              id="session-password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !username || !password}>
              {isPending ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
