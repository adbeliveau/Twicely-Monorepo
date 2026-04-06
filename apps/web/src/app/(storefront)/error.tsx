'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-gray-500">An unexpected error occurred</p>
      <button onClick={reset} className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
        Try again
      </button>
    </div>
  );
}
