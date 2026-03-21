import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Buyer Protection | Twicely' };

export default function BuyerProtectionPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Buyer Protection</h1>
      <p className="text-muted-foreground">
        How buyer protection works on Twicely. Content coming soon.
      </p>
    </div>
  );
}
