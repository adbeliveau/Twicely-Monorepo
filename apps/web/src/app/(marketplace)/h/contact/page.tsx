import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { ContactCaseForm } from '@/components/helpdesk/contact-case-form';

export const metadata: Metadata = { title: 'Contact Support | Twicely' };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ContactSupportPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login?callbackUrl=/h/contact');

  const params = await searchParams;
  const prefillType = params['type'];
  const prefillOrderId = params['orderId'];
  const prefillListingId = params['listingId'];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Contact Support</h1>
        <p className="mt-2 text-sm text-gray-500">
          Fill out the form below and we&apos;ll respond within one business day.
        </p>
      </div>

      <ContactCaseForm
        prefillType={prefillType}
        prefillOrderId={prefillOrderId}
        prefillListingId={prefillListingId}
      />
    </div>
  );
}
