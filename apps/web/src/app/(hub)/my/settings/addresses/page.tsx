import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getUserAddresses } from '@/lib/queries/address';
import { AddressManagement } from '@/components/pages/settings/address-management';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shipping Addresses | Twicely',
  robots: 'noindex',
};

export default async function AddressesPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/my/settings/addresses');
  }

  const addresses = await getUserAddresses(session.user.id);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Shipping Addresses</h1>
      <p className="text-muted-foreground mb-8">
        Manage your saved shipping addresses for faster checkout.
      </p>

      <AddressManagement initialAddresses={addresses} />
    </div>
  );
}
