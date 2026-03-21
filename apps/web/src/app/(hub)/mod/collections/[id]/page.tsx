import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminCollectionById } from '@/lib/queries/admin-curated-collections';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CollectionForm } from '@/components/admin/collections/collection-form';
import { CollectionItemManager } from '@/components/admin/collections/collection-item-manager';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const collection = await getAdminCollectionById(id);
  return {
    title: collection ? `${collection.title} | Twicely Hub` : 'Collection | Twicely Hub',
  };
}

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('update', 'CuratedCollection')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const collection = await getAdminCollectionById(id);

  if (!collection) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Collection" />
        <p className="text-gray-500">Collection not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={collection.title}
        description={collection.isPublished ? 'Published' : 'Draft'}
      />

      <div className="max-w-2xl">
        <h2 className="text-base font-semibold text-primary mb-4">Collection Details</h2>
        <CollectionForm mode="edit" collection={collection} />
      </div>

      <div>
        <h2 className="text-base font-semibold text-primary mb-4">Collection Items</h2>
        <CollectionItemManager collectionId={collection.id} items={collection.items} />
      </div>
    </div>
  );
}
