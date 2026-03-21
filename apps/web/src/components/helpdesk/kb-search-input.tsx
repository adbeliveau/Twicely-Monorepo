'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

interface SearchArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  categoryId: string | null;
}

interface KbSearchInputProps {
  categorySlugMap?: Map<string, string>;
}

export function KbSearchInput({ categorySlugMap }: KbSearchInputProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (q: string) => {
    if (q.length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/kb/search?q=${encodeURIComponent(q)}&limit=8`);
      const json = (await res.json()) as { success: boolean; articles?: SearchArticle[] };
      if (json.success && Array.isArray(json.articles)) {
        setResults(json.articles);
        setIsOpen(true);
      }
    } catch {
      // Silent failure — search is non-critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void fetchResults(value.trim());
    }, 300);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      setIsOpen(false);
      router.push(`/h?q=${encodeURIComponent(query.trim())}`);
    }
  }

  function handleResultClick(article: SearchArticle) {
    const catSlug = article.categoryId && categorySlugMap
      ? (categorySlugMap.get(article.categoryId) ?? 'general')
      : 'general';
    setIsOpen(false);
    router.push(`/h/${catSlug}/${article.slug}`);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm">
        <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search help articles…"
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          aria-label="Search help articles"
          aria-autocomplete="list"
          aria-expanded={isOpen}
        />
        {isLoading && (
          <span className="text-xs text-gray-400">Searching…</span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          {results.map((article) => (
            <li key={article.id}>
              <button
                type="button"
                onClick={() => handleResultClick(article)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
              >
                <p className="text-sm font-medium text-gray-900">{article.title}</p>
                {article.excerpt && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{article.excerpt}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && results.length === 0 && !isLoading && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg px-4 py-3">
          <p className="text-sm text-gray-500">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
