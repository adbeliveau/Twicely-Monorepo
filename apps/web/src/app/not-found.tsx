import Link from 'next/link';
import { SearchBar } from '@/components/shared/search-bar';
import { Button } from '@twicely/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-4 text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      {/* Search Bar */}
      <div className="mt-8 w-full max-w-md">
        <SearchBar placeholder="Search for something else..." />
      </div>

      {/* Popular Categories */}
      <div className="mt-8">
        <p className="mb-3 text-sm text-muted-foreground">
          Try browsing popular categories:
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/c/electronics"
            className="rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            Electronics
          </Link>
          <Link
            href="/c/apparel-accessories"
            className="rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            Apparel & Accessories
          </Link>
          <Link
            href="/c/collectibles-luxury"
            className="rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            Collectibles & Luxury
          </Link>
          <Link
            href="/c/home-garden"
            className="rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            Home & Garden
          </Link>
        </div>
      </div>

      {/* Home Link */}
      <div className="mt-8">
        <Button asChild variant="outline">
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    </div>
  );
}
