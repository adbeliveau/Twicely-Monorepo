'use client';

import { useTransition, useState } from 'react';
import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import { Loader2, Link2, Unlink, RefreshCw, Clock } from 'lucide-react';
import {
  disconnectAccountingIntegration,
  triggerAccountingSync,
  updateSyncFrequency,
  type IntegrationRow,
} from '@/lib/actions/accounting-integration';

interface Props {
  integrations: IntegrationRow[];
}

const PROVIDER_LABELS: Record<string, string> = {
  QUICKBOOKS: 'QuickBooks',
  XERO: 'Xero',
};

const PROVIDER_AUTHORIZE_URLS: Record<string, string> = {
  QUICKBOOKS: '/api/accounting/quickbooks/authorize',
  XERO: '/api/accounting/xero/authorize',
};

export function AccountingIntegrationsClient({ integrations }: Props) {
  const [isPending, startTransition] = useTransition();
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const connectedProviders = new Set(
    integrations.filter((i) => i.status === 'CONNECTED').map((i) => i.provider),
  );

  function handleDisconnect(integrationId: string) {
    startTransition(async () => {
      const result = await disconnectAccountingIntegration({ integrationId });
      if (!result.success) {
        setSyncResult(result.error);
      }
    });
  }

  function handleSync(integrationId: string) {
    startTransition(async () => {
      setSyncResult(null);
      const result = await triggerAccountingSync({ integrationId });
      if (result.success) {
        setSyncResult(`Synced ${result.recordsSynced} records (${result.recordsFailed} failed)`);
      } else {
        setSyncResult(result.error);
      }
    });
  }

  function handleFrequencyChange(integrationId: string, frequency: string) {
    startTransition(async () => {
      await updateSyncFrequency({ integrationId, frequency });
    });
  }

  return (
    <div className="space-y-6">
      {/* Connect buttons for providers not yet connected */}
      <Card>
        <CardHeader>
          <CardTitle>Connect a Provider</CardTitle>
          <CardDescription>
            Link your accounting software to automatically sync transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          {(['QUICKBOOKS', 'XERO'] as const).map((provider) => (
            <Button
              key={provider}
              asChild={!connectedProviders.has(provider)}
              variant={connectedProviders.has(provider) ? 'secondary' : 'default'}
              disabled={connectedProviders.has(provider)}
            >
              {connectedProviders.has(provider) ? (
                <span>
                  <Link2 className="mr-2 h-4 w-4" />
                  {PROVIDER_LABELS[provider]} Connected
                </span>
              ) : (
                <Link href={PROVIDER_AUTHORIZE_URLS[provider] ?? '#'}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect {PROVIDER_LABELS[provider]}
                </Link>
              )}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Connected integrations */}
      {integrations
        .filter((i) => i.status === 'CONNECTED')
        .map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>{PROVIDER_LABELS[integration.provider] ?? integration.provider}</CardTitle>
                  <Badge variant="outline">Connected</Badge>
                  {integration.companyName && (
                    <span className="text-sm text-muted-foreground">{integration.companyName}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(integration.id)}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Now
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDisconnect(integration.id)}
                    disabled={isPending}
                  >
                    <Unlink className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              </div>
              <CardDescription>
                {integration.lastSyncAt
                  ? `Last synced: ${new Date(integration.lastSyncAt).toLocaleString()}`
                  : 'Never synced'}
                {integration.lastSyncStatus === 'FAILED' && (
                  <span className="ml-2 text-red-500">
                    (Failed — {integration.syncErrorCount} error{integration.syncErrorCount !== 1 ? 's' : ''})
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Sync frequency:</span>
                </div>
                <Select
                  defaultValue={integration.syncFrequency ?? 'DAILY'}
                  onValueChange={(value) => handleFrequencyChange(integration.id, value)}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOURLY">Hourly</SelectItem>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}

      {/* Disconnected integrations */}
      {integrations.filter((i) => i.status === 'DISCONNECTED').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Previously Connected</CardTitle>
          </CardHeader>
          <CardContent>
            {integrations
              .filter((i) => i.status === 'DISCONNECTED')
              .map((i) => (
                <div key={i.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">
                    {PROVIDER_LABELS[i.provider] ?? i.provider}
                    {i.companyName && ` — ${i.companyName}`}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link href={PROVIDER_AUTHORIZE_URLS[i.provider] ?? '#'}>Reconnect</Link>
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {syncResult && (
        <p className="text-sm text-muted-foreground">{syncResult}</p>
      )}
    </div>
  );
}
