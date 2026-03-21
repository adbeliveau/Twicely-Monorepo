'use client';

import { useRef, useEffect } from 'react';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@twicely/ui/input';
import { Button } from '@twicely/ui/button';

interface Category {
  name: string;
  slug: string;
  sortOrder: number;
}

interface StoreCategoriesEditorProps {
  categories: Category[];
  onChange: (categories: Category[]) => void;
  disabled?: boolean;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export function StoreCategoriesEditor({ categories, onChange, disabled = false }: StoreCategoriesEditorProps) {
  const maxCategories = 20;
  const lastInputRef = useRef<HTMLInputElement>(null);
  const shouldFocusLast = useRef(false);

  useEffect(() => {
    if (shouldFocusLast.current && lastInputRef.current) {
      lastInputRef.current.focus();
      shouldFocusLast.current = false;
    }
  }, [categories.length]);

  const handleNameChange = (index: number, name: string) => {
    const updated = categories.map((cat, i) =>
      i === index ? { ...cat, name, slug: generateSlug(name) } : cat
    );
    onChange(updated);
  };

  const handleAdd = () => {
    if (categories.length >= maxCategories) return;
    shouldFocusLast.current = true;
    onChange([...categories, { name: '', slug: '', sortOrder: categories.length }]);
  };

  const handleRemove = (index: number) => {
    const updated = categories
      .filter((_, i) => i !== index)
      .map((cat, i) => ({ ...cat, sortOrder: i }));
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...categories];
    const temp = updated[index - 1]!;
    updated[index - 1] = { ...updated[index]!, sortOrder: index - 1 };
    updated[index] = { ...temp, sortOrder: index };
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === categories.length - 1) return;
    const updated = [...categories];
    const temp = updated[index]!;
    updated[index] = { ...updated[index + 1]!, sortOrder: index };
    updated[index + 1] = { ...temp, sortOrder: index + 1 };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {categories.map((cat, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              ref={index === categories.length - 1 ? lastInputRef : undefined}
              value={cat.name}
              onChange={(e) => handleNameChange(index, e.target.value)}
              placeholder="Category name"
              maxLength={100}
              className="flex-1"
              disabled={disabled}
            />
            <span className="text-xs text-muted-foreground w-24 truncate">
              {cat.slug || 'auto-slug'}
            </span>
            <Button variant="ghost" size="icon-xs" onClick={() => handleMoveUp(index)} disabled={disabled || index === 0}>
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => handleMoveDown(index)} disabled={disabled || index === categories.length - 1}>
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => handleRemove(index)} disabled={disabled}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={handleAdd} disabled={disabled || categories.length >= maxCategories}>
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
        <span className="text-xs text-muted-foreground">
          {categories.length} of {maxCategories} categories
        </span>
      </div>
    </div>
  );
}
