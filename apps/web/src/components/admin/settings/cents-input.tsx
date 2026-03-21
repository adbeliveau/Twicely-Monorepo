'use client';

/**
 * Input component for monetary values stored as integer cents.
 * Displays as dollars, stores/submits as cents.
 */

interface CentsInputProps {
  value: number;
  onChange: (cents: number) => void;
  label?: string;
  disabled?: boolean;
}

export function CentsInput({ value, onChange, label, disabled }: CentsInputProps) {
  const dollars = (value / 100).toFixed(2);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      onChange(Math.round(parsed * 100));
    }
  }

  return (
    <div className="space-y-1">
      {label && <label className="text-xs font-medium text-gray-600">{label}</label>}
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={dollars}
          onChange={handleChange}
          disabled={disabled}
          className="w-full rounded-md border border-gray-300 py-1.5 pl-6 pr-3 text-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
    </div>
  );
}
