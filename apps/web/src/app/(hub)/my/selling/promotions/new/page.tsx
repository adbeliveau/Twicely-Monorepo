import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { db } from '@twicely/db';
import { category, listing } from '@twicely/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getSellerInfoForGates } from '@/lib/queries/storefront';
import { canUseFeature } from '@twicely/utils/tier-gates';
import { PromotionForm } from '@/components/promotions/promotion-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create Promotion | Twicely',
  robots: 'noindex',
};

export default async function NewPromotionPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login');

  const userId = session.user.id;
  const gates = await getSellerInfoForGates(userId);
  const storeTier = gates?.storeTier ?? 'NONE';
  if (!canUseFeature(storeTier, 'promotions')) {
    redirect('/my/selling/promotions');
  }

  const [categories, listings] = await Promise.all([
    db
      .select({ id: category.id, name: category.name })
      .from(category)
      .where(eq(category.isActive, true))
      .orderBy(asc(category.name)),
    db
      .select({ id: listing.id, title: listing.title })
      .from(listing)
      .where(eq(listing.ownerUserId, userId))
      .orderBy(asc(listing.title))
      .limit(100),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Promotion</h1>
        <p className="text-muted-foreground">Set up a new sale or coupon for your store.</p>
      </div>
      <PromotionForm
        categories={categories}
        listings={listings.map((l) => ({ id: l.id, title: l.title ?? '' }))}
      />
    </div>
  );
}
