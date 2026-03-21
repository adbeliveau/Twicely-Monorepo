'use client';

import Link from 'next/link';
import { Button } from '@twicely/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold">Something went wrong on our end</h1>
      <p className="mt-4 text-muted-foreground">
        We&apos;re sorry, but something unexpected happened. Please try again.
      </p>

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    </div>
  );
}
