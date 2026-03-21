import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck, ShieldOff, AlertTriangle, ExternalLink } from 'lucide-react';
import { verifyCertificate } from '@/lib/queries/authentication-verify';

interface VerifyPageProps {
  params: Promise<{ certNumber: string }>;
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const { certNumber } = await params;
  return {
    title: `Verify Certificate ${certNumber} | Twicely`,
    robots: 'noindex',
  };
}

export default async function VerifyCertificatePage({ params }: VerifyPageProps) {
  const { certNumber } = await params;
  const result = await verifyCertificate(certNumber);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          twicely.co
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Certificate Verification</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{certNumber}</p>
      </div>

      {result.status === 'VALID' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-emerald-600" />
            <h2 className="mt-3 text-xl font-semibold text-emerald-800">
              This item has been authenticated by Twicely
            </h2>
            {result.authenticationDate && (
              <p className="mt-1 text-sm text-emerald-700">
                Authenticated on {result.authenticationDate.toLocaleDateString()}
              </p>
            )}
            {result.authenticatorName && (
              <p className="mt-0.5 text-sm text-emerald-700">By {result.authenticatorName}</p>
            )}
          </div>

          {result.listingTitle && (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm font-medium text-muted-foreground">Item</p>
              <p className="mt-1 font-medium">{result.listingTitle}</p>
              {result.listingThumbnailUrl && (
                <Image
                  src={result.listingThumbnailUrl}
                  alt={result.listingTitle ?? 'Item'}
                  width={200}
                  height={200}
                  className="mt-3 rounded-lg object-cover"
                />
              )}
            </div>
          )}

          {result.photoUrls && result.photoUrls.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-medium">Authentication Photos</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Compare these photos against the item you received to verify it is the same item
                that was authenticated.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {result.photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative block">
                    <Image
                      src={url}
                      alt={`Authentication photo ${i + 1}`}
                      width={300}
                      height={300}
                      className="h-40 w-full rounded-lg object-cover"
                    />
                    <ExternalLink className="absolute bottom-2 right-2 h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {result.status === 'EXPIRED' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-600" />
          <h2 className="mt-3 text-xl font-semibold text-amber-800">Certificate Expired</h2>
          <p className="mt-2 text-sm text-amber-700">{result.message}</p>
        </div>
      )}

      {result.status === 'TRANSFERRED' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-600" />
          <h2 className="mt-3 text-xl font-semibold text-amber-800">Certificate Transferred</h2>
          <p className="mt-2 text-sm text-amber-700">{result.message}</p>
        </div>
      )}

      {result.status === 'REVOKED' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <ShieldOff className="mx-auto h-12 w-12 text-red-600" />
          <h2 className="mt-3 text-xl font-semibold text-red-800">Certificate Revoked</h2>
          <p className="mt-2 text-sm text-red-700">{result.message}</p>
        </div>
      )}

      {result.status === 'NOT_FOUND' && (
        <div className="rounded-xl border bg-muted/30 p-6 text-center">
          <ShieldOff className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-3 text-xl font-semibold">Certificate Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
        </div>
      )}

      <div className="mt-8 rounded-lg border bg-muted/20 p-4">
        <p className="text-xs text-muted-foreground">
          Authentication services are provided by independent third-party partners. Twicely
          facilitates the authentication process but does not independently verify item
          authenticity. Results represent the opinion of the authenticating party. Twicely is
          not liable for authentication errors. See our Authentication Terms for full details.
        </p>
      </div>
    </div>
  );
}
