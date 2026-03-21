import Link from 'next/link';
import { buildCategoryUrl } from '@twicely/utils/format';

interface SubcategoryNavProps {
  categories: Array<{
    name: string;
    slug: string;
    active: boolean;
  }>;
  parentSlug: string;
}

export function SubcategoryNav({ categories, parentSlug }: SubcategoryNavProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <nav className="relative">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {/* "All" link back to parent category */}
        <Link
          href={buildCategoryUrl(parentSlug)}
          className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
            categories.every((c) => !c.active)
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-background text-foreground hover:bg-muted'
          }`}
        >
          All
        </Link>

        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={buildCategoryUrl(parentSlug, cat.slug)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
              cat.active
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
