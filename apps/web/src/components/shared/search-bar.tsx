'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, TrendingUp, Tag, LayoutGrid, X } from 'lucide-react';
import { Input } from '@twicely/ui/input';
import type { SearchSuggestion } from '@/app/api/search/suggestions/route';

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function SearchBar({
  defaultValue = '',
  placeholder = 'Search for anything...',
  className,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch trending on mount (will show on focus when query is empty)
  useEffect(() => {
    fetch('/api/search/trending')
      .then((r) => r.json())
      .then((data: { trending?: string[] }) => setTrending(data.trending ?? []))
      .catch(() => {/* silently ignore */});
  }, []);

  // Debounced suggestions fetch
  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { suggestions?: SearchSuggestion[] };
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);
    fetchSuggestions(val);
  }

  function navigate(term: string) {
    const trimmed = term.trim();
    setIsOpen(false);
    setActiveIndex(-1);
    if (trimmed) {
      setQuery(trimmed);
      router.push(`/s?q=${encodeURIComponent(trimmed)}`);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = getDropdownItems();
    if (activeIndex >= 0 && items[activeIndex]) {
      navigate(items[activeIndex]);
      return;
    }
    const trimmed = query.trim();
    setIsOpen(false);
    router.push(trimmed ? `/s?q=${encodeURIComponent(trimmed)}` : '/s');
  }

  function getDropdownItems(): string[] {
    if (query.length >= MIN_QUERY_LENGTH) return suggestions.map((s) => s.text);
    return trending;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const items = getDropdownItems();
    if (!isOpen || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  function getSuggestionIcon(type: SearchSuggestion['type']) {
    if (type === 'brand') return <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    if (type === 'category') return <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    return <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  }

  const showTrending = isOpen && query.length < MIN_QUERY_LENGTH && trending.length > 0;
  const showSuggestions = isOpen && query.length >= MIN_QUERY_LENGTH &&
    (suggestions.length > 0 || loadingSuggestions);
  const showDropdown = showTrending || showSuggestions;
  const dropdownItems = getDropdownItems();

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <form role="search" aria-label="Search listings" onSubmit={handleSubmit}>
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="search-input" className="sr-only">Search for items</label>
          <Input
            id="search-input"
            type="search"
            placeholder={placeholder}
            value={query}
            onChange={handleChange}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? 'search-suggestions' : undefined}
            className="pl-10 pr-8"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => { setQuery(''); setSuggestions([]); setIsOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {showDropdown && (
        <div
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-background shadow-lg"
        >
          {showTrending && (
            <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Trending searches
            </div>
          )}

          {loadingSuggestions && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
          )}

          {dropdownItems.map((item, i) => {
            const suggestion = query.length >= MIN_QUERY_LENGTH ? suggestions[i] : null;
            return (
              <button
                key={item}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); navigate(item); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  i === activeIndex ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                {suggestion
                  ? getSuggestionIcon(suggestion.type)
                  : <TrendingUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                }
                <span className="flex-1 truncate">{item}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
