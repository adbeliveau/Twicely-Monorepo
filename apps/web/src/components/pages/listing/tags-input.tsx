'use client';

import { useState, useCallback } from 'react';
import { Input } from '@twicely/ui/input';
import { X } from 'lucide-react';
import { cn } from '@twicely/utils';
import { MAX_TAGS } from '@/types/listing-form';

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  error?: string;
}

export function TagsInput({ value, onChange, disabled, error }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tag = inputValue.trim().toLowerCase();
        if (tag && !value.includes(tag) && value.length < MAX_TAGS) {
          onChange([...value, tag]);
          setInputValue('');
        }
      } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        onChange(value.slice(0, -1));
      }
    },
    [inputValue, value, onChange]
  );

  const handleRemove = useCallback(
    (tagToRemove: string) => {
      onChange(value.filter((tag) => tag !== tagToRemove));
    },
    [value, onChange]
  );

  const canAddMore = value.length < MAX_TAGS;

  return (
    <div>
      <div
        className={cn(
          'flex flex-wrap gap-2 rounded-md border bg-background p-2',
          error && 'border-destructive',
          disabled && 'opacity-50'
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove {tag}</span>
              </button>
            )}
          </span>
        ))}
        {canAddMore && (
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? 'Type and press Enter to add tags...' : 'Add more...'}
            disabled={disabled}
            className="min-w-[120px] flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{error}</span>
        <span>
          {value.length}/{MAX_TAGS} tags
        </span>
      </div>
    </div>
  );
}
