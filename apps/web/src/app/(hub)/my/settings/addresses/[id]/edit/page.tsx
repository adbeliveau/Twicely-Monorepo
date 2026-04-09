import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import { getAddressById } from '@/lib/queries/address';
import { AddressForm } from '@/components/shared/address-form';
import { updateAddress } from '@/lib/actions/addresses';
import type { AddressFormData } from '@/lib/validations/address';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit Address | Twicely',
  robots: 'noindex',
};

interface EditAddressPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAddressPage({ params }: EditAddressPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/my/settings/addresses');
  }

  const { id } = await params;
  const address = await getAddressById(id, session.user.id);

  if (!address) {
    notFound();
  }

  async function handleUpdate(data: AddressFormData) {
    'use server';
    return updateAddress(id, data);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/my/settings/addresses"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Addresses
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">Edit Address</h1>
      {address.label && (
        <p className="text-muted-foreground mb-8">{address.label}</p>
      )}

      <AddressForm
        initialData={address}
        onSubmit={handleUpdate}
        submitLabel="Update Address"
      />
    </div>
  );
}
