import { CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import type { IdentityVerificationRecord } from '@/lib/queries/identity-verification';

interface Props {
  status: 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED' | 'NONE';
  record: IdentityVerificationRecord | null;
  basicVerified: boolean;
}

const STATUS_CONFIG = {
  NOT_REQUIRED: { label: 'Not Required', variant: 'secondary' as const, Icon: CheckCircle },
  PENDING:      { label: 'Verification In Progress', variant: 'default' as const, Icon: Clock },
  VERIFIED:     { label: 'Verified', variant: 'default' as const, Icon: CheckCircle },
  FAILED:       { label: 'Verification Failed', variant: 'destructive' as const, Icon: XCircle },
  EXPIRED:      { label: 'Verification Expired', variant: 'destructive' as const, Icon: AlertTriangle },
  NONE:         { label: 'Not Started', variant: 'secondary' as const, Icon: AlertTriangle },
};

export function VerificationStatusCard({ status, record, basicVerified }: Props) {
  const config = STATUS_CONFIG[status];
  const { Icon } = config;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" aria-hidden="true" />
          Identity Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={config.variant}>{config.label}</Badge>
          {record?.level && (
            <span className="text-sm text-muted-foreground">Level: {record.level}</span>
          )}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle
              className={`h-4 w-4 ${basicVerified ? 'text-green-600' : 'text-muted-foreground'}`}
              aria-hidden="true"
            />
            <span>Basic verification (email + phone): {basicVerified ? 'Complete' : 'Incomplete'}</span>
          </div>
        </div>

        {status === 'VERIFIED' && record?.verifiedAt && (
          <p className="text-sm text-muted-foreground">
            Verified on {new Date(record.verifiedAt).toLocaleDateString()}
            {record.expiresAt && (
              <> — expires {new Date(record.expiresAt).toLocaleDateString()}</>
            )}
          </p>
        )}

        {status === 'PENDING' && (
          <p className="text-sm text-muted-foreground">
            Your verification is being reviewed. We will notify you once complete.
          </p>
        )}

        {status === 'FAILED' && record?.failureReason && (
          <p className="text-sm text-destructive">
            Reason: {record.failureReason}
            {record.retryAfter && (
              <> — Retry available after {new Date(record.retryAfter).toLocaleDateString()}</>
            )}
          </p>
        )}

        {status === 'EXPIRED' && record?.expiresAt && (
          <p className="text-sm text-destructive">
            Your verification expired on {new Date(record.expiresAt).toLocaleDateString()}.
            Please re-verify to maintain your account status.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
