'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@twicely/ui/input';
import { Search } from 'lucide-react';

interface FlagSearchInputProps {
  currentSearch?: string;
}

export function FlagSearchInput({ currentSearch }: FlagSearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set('q', value.trim());
    } else {
      params.delete('q');
    }
    router.push(`/flags?${params.toString()}`);
  }

  return (
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        className="pl-9"
        placeholder="Search flags by key or name..."
        defaultValue={currentSearch ?? ''}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSearch((e.target as HTMLInputElement).value);
          }
        }}
      />
    </div>
  );
}
