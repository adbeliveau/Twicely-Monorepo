import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { InviteForm } from '@/components/delegation/invite-form';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { TIER_STAFF_LIMITS } from '@/lib/delegation/constants';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invite Staff Member | Twicely',
  robots: 'noindex',
};

export default async function InviteStaffPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login');

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
            Upgrade to Store Pro to invite staff members.
          </p>
          <Button asChild>
            <Link href="/my/selling/subscription">Upgrade plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold">Invite staff member</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Staff members can only access your store using the permissions you grant them.
        </p>
      </div>
      <InviteForm />
    </div>
  );
}
