import Link from 'next/link';

export default function StoreNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Store not found</h1>
      <p className="mt-2 text-gray-600">
        This store doesn&apos;t exist or is currently unavailable.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
      >
        Browse Twicely
      </Link>
    </div>
  );
}
