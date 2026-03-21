import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getVerificationStatus, getMyVerificationHistory } from '@/lib/actions/identity-verification';
import { VerificationStatusCard } from '@/components/pages/verification/verification-status-card';
import { StripeIdentityEmbed } from '@/components/pages/verification/stripe-identity-embed';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verification | Twicely',
  robots: 'noindex',
};

export default async function VerificationPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/verification');
  }

  const [statusResult, history] = await Promise.all([
    getVerificationStatus(),
    getMyVerificationHistory(),
  ]);

  const canStartVerification =
    statusResult.status === 'NONE' ||
    statusResult.status === 'FAILED' ||
    statusResult.status === 'EXPIRED';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Identity Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your identity to access advanced selling features.
        </p>
      </div>

      {/* Current status */}
      <VerificationStatusCard
        status={statusResult.status}
        record={statusResult.record}
        basicVerified={statusResult.basicVerified}
      />

      {/* Start verification */}
      {canStartVerification && (
        <Card>
          <CardHeader>
            <CardTitle>Start Enhanced Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <StripeIdentityEmbed triggeredBy="USER_INITIATED" />
          </CardContent>
        </Card>
      )}

      {/* Verification history */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Verification History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div className="space-y-0.5">
                    <span className="font-medium capitalize">{record.level.toLowerCase()} verification</span>
                    <p className="text-muted-foreground">
                      Started {new Date(record.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={
                      record.status === 'VERIFIED'
                        ? 'text-green-700'
                        : record.status === 'FAILED' || record.status === 'EXPIRED'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }
                  >
                    {record.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
