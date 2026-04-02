'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { SEARCH_INDEX, type SearchEntry } from './settings-search-index';

function searchSettings(query: string): SearchEntry[] {
  if (!query.trim()) return [];
  const words = query.toLowerCase().trim().split(/\s+/);
  return SEARCH_INDEX
    .filter((e) => {
      const haystack = [e.key, e.title, e.description, e.tabLabel].join(' ').toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .slice(0, 8);
}

export function SettingsSearch() {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const results = useMemo(() => searchSettings(query), [query]);

  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setSelectedIdx(-1);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showResults) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIdx >= 0 && results[selectedIdx]) {
      e.preventDefault();
      router.push(results[selectedIdx].href);
      setShowResults(false);
      setQuery('');
    } else if (e.key === 'Escape') {
      setShowResults(false);
    }
  }

  function handleSearch(value: string) {
    setQuery(value);
    setShowResults(value.trim().length > 0);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowResults(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search all settings... (e.g. payout schedule, database url, TF rate)"
          className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setShowResults(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((r, i) => (
            <Link
              key={r.key}
              href={r.href}
              onClick={() => { setShowResults(false); setQuery(''); }}
              className={[
                'flex items-center justify-between px-4 py-3 text-sm transition first:rounded-t-lg last:rounded-b-lg',
                i === selectedIdx ? 'bg-blue-50' : 'hover:bg-gray-50',
              ].join(' ')}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{r.title}</p>
                <p className="truncate text-xs text-gray-500">{r.description}</p>
              </div>
              <span className="ml-3 shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                {r.tabLabel}
              </span>
            </Link>
          ))}
        </div>
      )}

      {showResults && query && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-lg">
          No settings found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
