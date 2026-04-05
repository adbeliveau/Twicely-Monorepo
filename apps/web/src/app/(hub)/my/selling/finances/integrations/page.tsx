import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { Button } from '@twicely/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getAccountingIntegrations } from '@/lib/actions/accounting-integration';
import { AccountingIntegrationsClient } from '@/components/hub/accounting-integrations-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Accounting Integrations | Twicely',
  robots: 'noindex',
};

export default async function AccountingIntegrationsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/finances/integrations');
  }

  const result = await getAccountingIntegrations();
  const integrations = result.success ? result.integrations : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/my/selling/finances">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Accounting Integrations</h1>
          <p className="text-muted-foreground">
            Connect QuickBooks or Xero to automatically sync your sales, expenses, and payouts.
          </p>
        </div>
      </div>

      <AccountingIntegrationsClient integrations={integrations} />
    </div>
  );
}
