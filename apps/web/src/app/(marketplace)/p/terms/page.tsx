import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service | Twicely' };

export default function TermsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="text-muted-foreground">
        Twicely terms of service. Content coming soon.
      </p>
    </div>
  );
}
