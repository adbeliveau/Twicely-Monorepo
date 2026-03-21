import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'How It Works | Twicely' };

export default function HowItWorksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">How It Works</h1>
      <p className="text-muted-foreground">
        How buying and selling works on Twicely. Content coming soon.
      </p>
    </div>
  );
}
