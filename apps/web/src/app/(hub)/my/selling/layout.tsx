import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerProfile } from '@/lib/queries/seller';
import { Button } from '@twicely/ui/button';
import { Package, DollarSign, BarChart3, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: 'noindex',
};

export default async function SellingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling');
  }

  const sellerProfile = await getSellerProfile(session.user.id);

  // Allow non-sellers through to create their first listing
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';
  const isCreateListingPage = pathname === '/my/selling/listings/new';

  // Non-seller: show "Start selling" CTA (unless on create listing page)
  if (!sellerProfile && !isCreateListingPage) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Package className="h-16 w-16 text-muted-foreground mb-6" />
        <h1 className="text-3xl font-bold">Start selling on Twicely</h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          Turn your closet into cash. List your first item and reach millions of buyers.
        </p>

        <Button asChild size="lg" className="mt-8">
          <Link href="/my/selling/listings/new">Create your first listing</Link>
        </Button>

        <p className="mt-3 text-sm text-muted-foreground">
          Want a storefront?{' '}
          <Link
            href="/my/selling/onboarding?flow=business"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Set up a business account
          </Link>
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 max-w-2xl">
          <div className="flex flex-col items-center text-center">
            <DollarSign className="h-8 w-8 text-primary mb-2" />
            <h2 className="text-base font-medium">Free to start</h2>
            <p className="text-sm text-muted-foreground">
              No monthly fees. Only pay when you sell.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <BarChart3 className="h-8 w-8 text-primary mb-2" />
            <h2 className="text-base font-medium">Seller tools</h2>
            <p className="text-sm text-muted-foreground">
              Analytics, inventory tracking, and more.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <Shield className="h-8 w-8 text-primary mb-2" />
            <h2 className="text-base font-medium">Seller protection</h2>
            <p className="text-sm text-muted-foreground">
              We have your back with fraud prevention.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Seller: just render content (hub sidebar handles navigation)
  return <>{children}</>;
}
