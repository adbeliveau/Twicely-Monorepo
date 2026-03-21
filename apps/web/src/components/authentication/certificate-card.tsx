import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, ShieldOff, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';

type CertificateStatus = 'VALID' | 'EXPIRED' | 'TRANSFERRED' | 'REVOKED';

type CertificateCardProps = {
  certificateNumber: string;
  status: CertificateStatus;
  authenticationDate?: Date | null;
  authenticatorName?: string | null;
  photoUrls?: string[] | null;
};

const STATUS_CONFIG: Record<CertificateStatus, {
  icon: typeof ShieldCheck;
  label: string;
  className: string;
  variant: 'default' | 'secondary' | 'destructive';
}> = {
  VALID: { icon: ShieldCheck, label: 'Valid', className: 'text-emerald-600', variant: 'default' },
  EXPIRED: { icon: AlertTriangle, label: 'Expired', className: 'text-amber-600', variant: 'secondary' },
  TRANSFERRED: { icon: AlertTriangle, label: 'Transferred', className: 'text-amber-600', variant: 'secondary' },
  REVOKED: { icon: ShieldOff, label: 'Revoked', className: 'text-red-600', variant: 'destructive' },
};

export function CertificateCard({
  certificateNumber,
  status,
  authenticationDate,
  authenticatorName,
  photoUrls,
}: CertificateCardProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const verifyUrl = `/verify/${certificateNumber}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${config.className}`} />
            Authentication Certificate
          </span>
          <Badge variant={config.variant}>{config.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm text-muted-foreground">{certificateNumber}</span>
          <Link
            href={verifyUrl}
            target="_blank"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Verify <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        {authenticationDate && (
          <p className="text-xs text-muted-foreground">
            Authenticated: {authenticationDate.toLocaleDateString()}
          </p>
        )}
        {authenticatorName && (
          <p className="text-xs text-muted-foreground">By: {authenticatorName}</p>
        )}
        {photoUrls && photoUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photoUrls.slice(0, 4).map((url, i) => (
              <Image
                key={i}
                src={url}
                alt={`Authentication photo ${i + 1}`}
                width={64}
                height={64}
                className="h-16 w-16 flex-shrink-0 rounded object-cover"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
