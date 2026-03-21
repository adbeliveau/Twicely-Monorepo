'use client';

import { useState, useCallback, useEffect } from 'react';
import { Input } from '@twicely/ui/input';
import { cn } from '@twicely/utils';

interface PriceInputProps {
  value: number; // cents
  onChange: (cents: number) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

/**
 * Price input that displays dollars but stores cents.
 * Uses local state for free typing, syncs to parent on blur.
 */
export function PriceInput({ value, onChange, placeholder, disabled, error }: PriceInputProps) {
  // Local state for the text input - allows free typing
  const [localValue, setLocalValue] = useState(() =>
    value > 0 ? (value / 100).toFixed(2) : ''
  );

  // Sync from parent when value changes externally (not from our own input)
  useEffect(() => {
    const parentDisplay = value > 0 ? (value / 100).toFixed(2) : '';
    const localCents = parseFloat(localValue || '0') * 100;
    // Only sync if values are meaningfully different (not just formatting)
    if (Math.round(localCents) !== value) {
      setLocalValue(parentDisplay);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Allow empty
    if (!input) {
      setLocalValue('');
      onChange(0);
      return;
    }

    // Only allow digits and one decimal point
    // This regex allows: "5", "5.", "5.0", "5.00", "12.34", etc.
    if (!/^\d*\.?\d{0,2}$/.test(input)) {
      return; // Reject invalid input
    }

    setLocalValue(input);

    // Update parent with cents value
    const dollars = parseFloat(input);
    if (!isNaN(dollars)) {
      onChange(Math.round(dollars * 100));
    }
  }, [onChange]);

  const handleBlur = useCallback(() => {
    // Format nicely on blur (add trailing zeros, etc.)
    if (localValue && localValue !== '') {
      const dollars = parseFloat(localValue);
      if (!isNaN(dollars) && dollars > 0) {
        setLocalValue(dollars.toFixed(2));
      } else {
        setLocalValue('');
      }
    }
  }, [localValue]);

  return (
    <div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
        <Input
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder ?? '0.00'}
          disabled={disabled}
          className={cn('pl-7', error && 'border-destructive')}
        />
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
