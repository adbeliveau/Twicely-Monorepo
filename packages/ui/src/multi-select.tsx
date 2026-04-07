'use client';

import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  /** Controlled value */
  value?: string[];
  /** Uncontrolled default */
  defaultValue?: string[];
  onChange?: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Multi-select dropdown component.
 * Shows selected items as chips with remove buttons.
 * Supports keyboard navigation (arrows, enter, escape).
 */
export function MultiSelect({
  options,
  value,
  defaultValue = [],
  onChange,
  placeholder = 'Select options',
  disabled = false,
  className = '',
}: MultiSelectProps): React.ReactElement {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string[]>(defaultValue);
  const selected = isControlled ? value : internal;
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  function update(next: string[]) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  function toggle(val: string) {
    const next = selected.includes(val)
      ? selected.filter((v) => v !== val)
      : [...selected, val];
    update(next);
  }

  function remove(val: string) {
    update(selected.filter((v) => v !== val));
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          const focused = options[focusedIndex];
          if (focused) toggle(focused.value);
        }
        break;
      }
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        else
          setFocusedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : 0,
          );
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen)
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : options.length - 1,
          );
        break;
    }
  }

  return (
    <div ref={ref} className={['relative w-full', className].join(' ')}>
      {/* Trigger */}
      <div
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        onClick={() => !disabled && setIsOpen((p) => !p)}
        onKeyDown={handleKeyDown}
        className={[
          'flex min-h-10 w-full items-center rounded-lg border px-3 py-1.5 text-sm transition',
          'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        ].join(' ')}
      >
        <div className="flex flex-1 flex-wrap gap-1.5">
          {selected.length > 0 ? (
            selected.map((val) => {
              const opt = options.find((o) => o.value === val);
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                >
                  {opt?.label ?? val}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disabled) remove(val);
                    }}
                    className="rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                    aria-label={`Remove ${opt?.label ?? val}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })
          ) : (
            <span className="text-gray-400 dark:text-gray-500">
              {placeholder}
            </span>
          )}
        </div>
        <ChevronDown
          className={[
            'ml-2 size-4 shrink-0 text-gray-400 transition-transform',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {options.map((opt, i) => {
            const checked = selected.includes(opt.value);
            const focused = i === focusedIndex;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={checked}
                onClick={() => toggle(opt.value)}
                className={[
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
                  'text-gray-700 dark:text-gray-300',
                  focused ? 'bg-gray-100 dark:bg-gray-800' : '',
                  checked ? 'bg-primary/5 dark:bg-primary/10' : '',
                  !focused && !checked
                    ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    : '',
                ].join(' ')}
              >
                <div
                  className={[
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    checked
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-300 dark:border-gray-600',
                  ].join(' ')}
                >
                  {checked && (
                    <svg
                      className="size-3"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M3 6l2 2 4-4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                {opt.label}
              </div>
            );
          })}
          {options.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-gray-400">
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
