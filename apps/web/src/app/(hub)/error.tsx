'use client';

import Link from 'next/link';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-gray-500">{error.message || 'An unexpected error occurred'}</p>
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
          Try again
        </button>
        <Link href="/d" className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
