import Link from 'next/link';
import { buildCategoryUrl } from '@twicely/utils/format';
import { pluralize } from '@twicely/utils/format';

interface CategoryCardProps {
  name: string;
  slug: string;
  parentSlug?: string;
  listingCount: number;
}

export function CategoryCard({
  name,
  slug,
  parentSlug,
  listingCount,
}: CategoryCardProps) {
  return (
    <Link
      href={buildCategoryUrl(slug, parentSlug)}
      className="flex flex-col items-center justify-center rounded-lg border bg-card p-4 text-center transition-colors hover:bg-accent"
    >
      <h3 className="font-medium">{name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {pluralize(listingCount, 'listing')}
      </p>
    </Link>
  );
}
