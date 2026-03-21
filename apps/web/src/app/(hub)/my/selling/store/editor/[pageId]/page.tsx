import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerInfoForGates } from '@/lib/queries/storefront';
import { getPageForEditor } from '@/lib/queries/storefront-pages';
import { hasStoreTier } from '@twicely/utils/tier-gates';
import { PuckEditorClient } from './puck-editor-client';

export const metadata: Metadata = {
  title: 'Edit Page | Twicely',
  robots: 'noindex',
};

interface PageProps {
  params: Promise<{ pageId: string }>;
}

export default async function StoreEditorPageDetail({ params }: PageProps) {
  const { pageId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect('/auth/login');

  const gates = await getSellerInfoForGates(session.user.id);
  if (!gates || gates.sellerType !== 'BUSINESS') redirect('/my/selling/store');
  if (!hasStoreTier(gates.storeTier, 'POWER')) redirect('/my/selling/store');

  const page = await getPageForEditor(session.user.id, pageId);
  if (!page) notFound();

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <a
            href="/my/selling/store/editor"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to pages
          </a>
          <span className="text-sm font-medium text-gray-900">
            {page.title}
          </span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              page.isPublished
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {page.isPublished ? 'Published' : 'Draft'}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <PuckEditorClient
          pageId={page.id}
          initialData={page.puckData}
        />
      </div>
    </div>
  );
}
