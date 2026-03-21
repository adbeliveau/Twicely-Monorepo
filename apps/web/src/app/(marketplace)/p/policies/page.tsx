import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Policies | Twicely' };

export default function PoliciesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
      <p className="text-muted-foreground">
        Community guidelines and marketplace policies. Content coming soon.
      </p>
    </div>
  );
}
