'use client';

import { LayoutGrid, Map } from 'lucide-react';
import { Button } from '@twicely/ui/button';

export type SearchViewMode = 'grid' | 'map';

interface SearchViewToggleProps {
  mode: SearchViewMode;
  onModeChange: (mode: SearchViewMode) => void;
}

export function SearchViewToggle({ mode, onModeChange }: SearchViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border p-0.5">
      <Button
        variant={mode === 'grid' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => onModeChange('grid')}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={mode === 'map' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => onModeChange('map')}
        aria-label="Map view"
      >
        <Map className="h-4 w-4" />
      </Button>
    </div>
  );
}
