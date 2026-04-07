import Link from 'next/link';
import { Tag } from 'lucide-react';
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
      className="tw-tile"
    >
      <div className="tw-tile-icon">
        <Tag className="size-5" strokeWidth={2} />
      </div>
      <h3 className="text-sm font-extrabold text-[var(--tw-black)]">{name}</h3>
      <p className="text-xs text-[var(--tw-muted-lt)]">
        {pluralize(listingCount, 'listing')}
      </p>
    </Link>
  );
}
