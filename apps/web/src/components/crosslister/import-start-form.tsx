'use client';

/**
 * Account selector + start import button.
 * Source: F1.3 install prompt §2.9 Page 3
 */

import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { startImport } from '@/lib/actions/crosslister-import';
import { useTransition } from 'react';
import { Download } from 'lucide-react';
import type { CrosslisterAccount } from '@twicely/crosslister/db-types';

interface ImportStartFormProps {
  accounts: CrosslisterAccount[];
  onBatchStarted: (batchId: string) => void;
}

export function ImportStartForm({ accounts, onBatchStarted }: ImportStartFormProps) {
  const [isPending, startTransition] = useTransition();

  const eligibleAccounts = accounts.filter(
    (a) => a.status === 'ACTIVE' && a.firstImportCompletedAt === null,
  );

  if (eligibleAccounts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/40 p-8 text-center space-y-3">
        <p className="font-medium">No accounts available for import</p>
        <p className="text-sm text-muted-foreground">
          Connect an eBay account or your free import has already been used.
        </p>
        <Button asChild variant="secondary">
          <Link href="/my/selling/crosslist/connect">Connect a platform</Link>
        </Button>
      </div>
    );
  }

  const handleImport = (accountId: string) => {
    startTransition(async () => {
      const result = await startImport({ accountId });
      if (result.success && result.data?.batchId) {
        onBatchStarted(result.data.batchId);
      }
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select an account to import your listings. This is a one-time free import.
      </p>
      <div className="grid gap-3">
        {eligibleAccounts.map((account) => (
          <div key={account.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <p className="font-medium text-sm">
                {account.channel === 'EBAY' ? 'eBay' : account.channel}
              </p>
              {account.externalUsername && (
                <p className="text-xs text-muted-foreground">{account.externalUsername}</p>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => handleImport(account.id)}
              disabled={isPending}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              {isPending ? 'Starting...' : 'Start Import'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
