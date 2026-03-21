import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Selling Fees | Twicely' };

export default function FeesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Selling Fees</h1>
      <p className="text-muted-foreground">
        Our fee schedule for sellers. Content coming soon.
      </p>
    </div>
  );
}
