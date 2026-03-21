import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Saved Searches | Twicely' };

export default function SavedSearchesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Saved Searches</h1>
      <p className="text-muted-foreground">
        Your saved search alerts will appear here. Coming soon.
      </p>
    </div>
  );
}
