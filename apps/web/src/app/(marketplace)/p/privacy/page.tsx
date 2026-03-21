import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy | Twicely' };

export default function PrivacyPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground">
        How we handle your data. Content coming soon.
      </p>
    </div>
  );
}
