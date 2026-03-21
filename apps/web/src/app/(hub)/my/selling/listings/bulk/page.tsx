import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Bulk Upload | Twicely' };

export default function BulkUploadPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Bulk Upload</h1>
      <p className="text-muted-foreground">
        CSV bulk upload for listings is coming soon. For now, create listings
        individually or import from another platform via the Crosslister.
      </p>
    </div>
  );
}
