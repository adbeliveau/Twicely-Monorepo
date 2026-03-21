'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@twicely/utils';
import { Input } from '@twicely/ui/input';
import { Button } from '@twicely/ui/button';
import { ChevronDown, Search, Check, X, Loader2 } from 'lucide-react';
import type { CategorySearchResult } from '@/lib/queries/category-search';

interface CategoryPickerProps {
  value: CategorySearchResult | null;
  onChange: (category: CategorySearchResult | null) => void;
  disabled?: boolean;
  error?: string;
}

export function CategoryPicker({ value, onChange, disabled, error }: CategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CategorySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch categories based on query
  const fetchCategories = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }
      const response = await fetch(`/api/categories/search?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.categories ?? []);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchCategories(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, isOpen, fetchCategories]);

  // Load initial categories when opening
  useEffect(() => {
    if (isOpen && results.length === 0 && !query) {
      fetchCategories('');
    }
  }, [isOpen, results.length, query, fetchCategories]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSelect = (category: CategorySearchResult) => {
    onChange(category);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full justify-between font-normal',
          !value && 'text-muted-foreground',
          error && 'border-destructive'
        )}
      >
        <span className="truncate">
          {value ? (
            <span className="flex items-center gap-1">
              {value.parentName && (
                <span className="text-muted-foreground">{value.parentName} / </span>
              )}
              {value.name}
            </span>
          ) : (
            'Select category...'
          )}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <X
              className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search categories..."
              className="pl-8"
            />
          </div>

          {/* Results list */}
          <div className="mt-2 max-h-[240px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {query ? 'No categories found.' : 'No categories available.'}
              </div>
            ) : (
              <div className="space-y-0.5">
                {results.map((category) => {
                  const isSelected = value?.id === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleSelect(category)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 truncate">
                          {category.parentName && (
                            <span
                              className={cn(
                                'text-xs',
                                isSelected
                                  ? 'text-primary-foreground/70'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {category.parentName} /
                            </span>
                          )}
                          <span className="truncate">{category.name}</span>
                        </div>
                      </div>
                      {category.isLeaf && (
                        <span
                          className={cn(
                            'text-xs',
                            isSelected
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          )}
                        >
                          •
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
