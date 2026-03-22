import Link from 'next/link';
import { buildCategoryUrl } from '@twicely/utils/format';

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  listingCount: number;
}

interface Props {
  categories: CategoryData[];
}

/**
 * Horizontal scrollable category row with circular icons.
 * Visual design from V2 (public) homepage.
 */
export function HomepageCategoryRow({ categories }: Props) {
  return (
    <section className="border-b border-gray-200 dark:border-gray-700">
      <div className="mx-auto max-w-[1584px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="no-scrollbar flex gap-6 overflow-x-auto sm:gap-8">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={buildCategoryUrl(cat.slug)}
              className="flex flex-shrink-0 flex-col items-center gap-2 transition-transform hover:scale-105"
            >
              <div className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:h-[88px] sm:w-[88px]">
                {cat.name.charAt(0).toUpperCase()}
              </div>
              <span className="max-w-[80px] text-center text-xs font-medium text-gray-700 dark:text-gray-300 sm:max-w-[96px] sm:text-sm">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
