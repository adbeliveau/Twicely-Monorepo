import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Authentication | Twicely' };

export default function AuthenticationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Authentication</h1>
        <p className="text-muted-foreground mt-2">
          Expert and AI-assisted authentication for high-value items on Twicely.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How authentication works</h2>
        <p className="text-muted-foreground">
          Authenticated items are verified by Twicely experts or trusted
          authentication partners before delivery. Buyers of authenticated
          items receive 90-day coverage under our Authenticated protection
          tier — full refund, certificate void, and seller strike for
          confirmed counterfeit claims.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Verifying a certificate</h2>
        <p className="text-muted-foreground">
          Every authenticated item is issued a unique certificate number.
          You can verify any certificate by visiting{' '}
          <code className="text-foreground">/verify/[certNumber]</code> or by
          scanning the QR code on the item packaging.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">For sellers</h2>
        <p className="text-muted-foreground">
          Sellers can request pre-listing authentication from the{' '}
          <Link href="/my/selling/authentication" className="text-primary underline-offset-4 hover:underline">
            Authentication dashboard
          </Link>
          . Authenticated listings earn a trust badge and unlock access to
          the 90-day Authenticated protection tier.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Protection tiers</h2>
        <p className="text-muted-foreground">
          See{' '}
          <Link href="/p/buyer-protection" className="text-primary underline-offset-4 hover:underline">
            Buyer protection
          </Link>{' '}
          for the full breakdown of protection tiers, coverage limits, and
          claim windows.
        </p>
      </section>
    </div>
  );
}
