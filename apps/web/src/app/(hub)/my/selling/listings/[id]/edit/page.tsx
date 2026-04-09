import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getListingForEdit } from '@/lib/actions/listings-update-status';
import { getCategoryById } from '@/lib/queries/category-search';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getProjectionsForListing } from '@/lib/queries/crosslister';
import { ListingFormWrapper } from '@/components/pages/listing/listing-form-wrapper';
import type { ListingFormData, ListingCondition } from '@/types/listing-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit Listing | Twicely',
  robots: 'noindex',
};

interface EditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({ params }: EditListingPageProps) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Fetch listing and image cap in parallel
  const [result, maxImages] = await Promise.all([
    getListingForEdit(id),
    getPlatformSetting<number>('listing.maxImagesPerListing', 24),
  ]);

  if (!result) {
    // Not found or not owned
    redirect('/my/selling/listings');
  }

  const { listing, images } = result;

  const projections = await getProjectionsForListing(id, session.user.id);

  // Cannot edit SOLD or listings with enforcement issues
  if (listing.status === 'SOLD' || listing.enforcementState === 'REMOVED') {
    redirect('/my/selling/listings');
  }

  // Hydrate category if exists
  const category = listing.categoryId
    ? await getCategoryById(listing.categoryId)
    : null;

  // Convert DB data to form data format
  const initialData: Partial<ListingFormData> = {
    title: listing.title ?? '',
    description: listing.description ?? '',
    category,
    condition: listing.condition as ListingCondition | null,
    brand: listing.brand ?? '',
    tags: listing.tags ?? [],
    images: images.map((img) => ({
      id: img.id,
      url: img.url,
      position: img.position,
    })),
    quantity: listing.quantity,
    priceCents: listing.priceCents ?? 0,
    originalPriceCents: listing.originalPriceCents,
    cogsCents: listing.cogsCents,
    allowOffers: listing.allowOffers,
    autoAcceptOfferCents: listing.autoAcceptOfferCents,
    autoDeclineOfferCents: listing.autoDeclineOfferCents,
    freeShipping: listing.freeShipping,
    weightOz: listing.weightOz,
    lengthIn: listing.lengthIn,
    widthIn: listing.widthIn,
    heightIn: listing.heightIn,
    videoUrl: listing.videoUrl,
    videoThumbUrl: listing.videoThumbUrl,
    videoDurationSeconds: listing.videoDurationSeconds,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Listing</h1>
        <p className="text-muted-foreground">
          Update your listing details.
        </p>
      </div>

      <ListingFormWrapper mode="edit" listingId={id} initialData={initialData} maxImages={maxImages} />

      {projections.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">
            Cross-platform projections ({projections.length})
          </h2>
          <div className="space-y-1">
            {projections.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                <span className="text-gray-700 font-medium">{p.channel}</span>
                <span className={p.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-400'}>{p.status}</span>
                {p.externalUrl && (
                  <a href={p.externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
