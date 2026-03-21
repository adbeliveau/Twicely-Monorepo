import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerInfoForGates } from '@/lib/queries/storefront';
import { getPagesForOwner } from '@/lib/queries/storefront-pages';
import { hasStoreTier } from '@twicely/utils/tier-gates';
import { PageListClient } from './page-list-client';

export const metadata: Metadata = {
  title: 'Store Page Editor | Twicely',
  robots: 'noindex',
};

export default async function StoreEditorPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/auth/login');

  const gates = await getSellerInfoForGates(session.user.id);
  if (!gates || gates.sellerType !== 'BUSINESS') redirect('/my/selling/store');
  if (!hasStoreTier(gates.storeTier, 'POWER')) redirect('/my/selling/store');

  const pages = await getPagesForOwner(session.user.id);
  const maxPages = hasStoreTier(gates.storeTier, 'ENTERPRISE') ? 20 : 5;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Page Builder</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create custom pages for your storefront using the drag-and-drop editor.
        </p>
      </div>
      <PageListClient pages={pages} maxPages={maxPages} />
    </div>
  );
}
