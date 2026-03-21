'use client';

/**
 * Input component for rate values stored as integer basis points.
 * Displays as percentage (e.g., 1000 bps = 10.00%), stores/submits as bps.
 */

interface BpsInputProps {
  value: number;
  onChange: (bps: number) => void;
  label?: string;
  disabled?: boolean;
}

export function BpsInput({ value, onChange, label, disabled }: BpsInputProps) {
  const percent = (value / 100).toFixed(2);

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
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={percent}
          onChange={handleChange}
          disabled={disabled}
          className="w-full rounded-md border border-gray-300 py-1.5 pl-3 pr-7 text-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
      </div>
    </div>
  );
}
