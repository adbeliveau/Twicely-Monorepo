'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@twicely/ui/button';

type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  defaultView?: ViewMode;
}

export function ViewToggle({ defaultView = 'grid' }: ViewToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentView = (searchParams.get('view') as ViewMode) || defaultView;

  const setView = useCallback(
    (view: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (view === defaultView) {
        params.delete('view');
      } else {
        params.set('view', view);
      }
      const query = params.toString();
      router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, pathname, searchParams, defaultView]
  );

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={currentView === 'grid' ? 'default' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        onClick={() => setView('grid')}
        aria-label="Grid view"
        aria-pressed={currentView === 'grid'}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={currentView === 'list' ? 'default' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        onClick={() => setView('list')}
        aria-label="List view"
        aria-pressed={currentView === 'list'}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
