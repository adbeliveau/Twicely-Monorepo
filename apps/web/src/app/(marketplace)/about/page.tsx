import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About | Twicely' };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">About Twicely</h1>
      <p className="text-muted-foreground">
        The marketplace with built-in seller tools. Content coming soon.
      </p>
    </div>
  );
}
