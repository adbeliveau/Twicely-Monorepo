import { pluralize } from '@twicely/utils/format';
import { SortSelect } from './sort-select';

interface SearchResultsHeaderProps {
  query: string | null;
  totalCount: number;
  sort: string;
  /** When true, "Nearest" sort option is available (Decision #144). */
  hasLocation?: boolean;
}

export function SearchResultsHeader({
  query,
  totalCount,
  sort,
  hasLocation,
}: SearchResultsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {query ? (
          <h1 className="text-lg font-semibold">
            {pluralize(totalCount, 'result')} for &ldquo;{query}&rdquo;
          </h1>
        ) : (
          <h1 className="text-lg font-semibold">
            {pluralize(totalCount, 'listing')}
          </h1>
        )}
      </div>
      <SortSelect currentSort={sort} hasLocation={hasLocation} />
    </div>
  );
}
