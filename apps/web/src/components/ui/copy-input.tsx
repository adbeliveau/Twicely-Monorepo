'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyInputProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
}

/**
 * Input with a copy-to-clipboard button.
 * Shows "Copied!" feedback for 2 seconds after copying.
 */
export function CopyInput({
  value,
  onChange,
  readOnly = false,
  placeholder = '',
  label,
  className = '',
}: CopyInputProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-20 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder:text-gray-500"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-0 top-0 flex h-full items-center gap-1.5 border-l border-gray-200 px-3 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {copied ? (
            <>
              <Check className="size-4 text-success-500" />
              <span className="text-success-600 dark:text-success-400">
                Copied
              </span>
            </>
          ) : (
            <>
              <Copy className="size-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
