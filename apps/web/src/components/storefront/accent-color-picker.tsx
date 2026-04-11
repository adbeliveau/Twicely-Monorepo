'use client';

import { Check } from 'lucide-react';
import { ACCENT_PALETTE } from '@/lib/storefront/accent-palette';
import { cn } from '@twicely/utils/cn';

interface AccentColorPickerProps {
  value: string | null;
  onChange: (color: string) => void;
}

export function AccentColorPicker({ value, onChange }: AccentColorPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ACCENT_PALETTE.map((color) => {
        const isSelected = value === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'h-10 w-10 rounded-full transition-all',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              !isSelected && 'hover:ring-1 hover:ring-border'
            )}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
            aria-pressed={isSelected}
          >
            {isSelected && (
              <Check className="h-5 w-5 text-white mx-auto" strokeWidth={3} />
            )}
          </button>
        );
      })}
    </div>
  );
}
