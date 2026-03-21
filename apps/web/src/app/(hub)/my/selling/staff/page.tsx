import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getStaffMembers, getStaffCountForSeller } from '@/lib/queries/delegation';
import { StaffTable } from '@/components/delegation/staff-table';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { Skeleton } from '@twicely/ui/skeleton';
import { TIER_STAFF_LIMITS } from '@/lib/delegation/constants';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Staff Management | Twicely',
  robots: 'noindex',
};

export default async function StaffManagementPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login');

  // Require seller account
  if (!session.user.isSeller) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader>
          <CardTitle>Seller account required</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Staff management is only available to store owners.
          </p>
        </CardContent>
      </Card>
    );
  }

  const [seller] = await db
    .select({ id: sellerProfile.id, storeTier: sellerProfile.storeTier })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, session.user.id))
    .limit(1);

  if (!seller) redirect('/my/selling');

  const tierLimit = TIER_STAFF_LIMITS[seller.storeTier] ?? 0;

  // Tier gate: NONE and STARTER cannot use delegation
  if (tierLimit === 0) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader>
          <CardTitle>Store Pro required</CardTitle>
          <CardDescription>
            Staff management requires Store Pro or higher.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your current plan ({seller.storeTier}) does not include staff accounts.
            Upgrade to Store Pro to invite up to 5 staff members.
          </p>
          <Button asChild>
            <Link href="/my/selling/subscription">Upgrade plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const [members, currentCount] = await Promise.all([
    getStaffMembers(seller.id),
    getStaffCountForSeller(seller.id),
  ]);

  const limitLabel = tierLimit === 999 ? 'Unlimited' : String(tierLimit);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Staff management</h1>
          <p className="text-muted-foreground text-sm">
            {currentCount} of {limitLabel} staff slots used
          </p>
        </div>
        <Button asChild disabled={currentCount >= tierLimit && tierLimit !== 999}>
          <Link href="/my/selling/staff/invite">Invite staff member</Link>
        </Button>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">You haven&apos;t added any staff members yet.</p>
            <Button asChild>
              <Link href="/my/selling/staff/invite">Invite your first staff member</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <StaffTable members={members} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function StaffPageSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
