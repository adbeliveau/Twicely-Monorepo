'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import { cn } from '@twicely/utils';
import { CONDITION_OPTIONS, type ListingCondition } from '@/types/listing-form';

interface ConditionSelectProps {
  value: ListingCondition | null;
  onChange: (condition: ListingCondition | null) => void;
  disabled?: boolean;
  error?: string;
}

export function ConditionSelect({ value, onChange, disabled, error }: ConditionSelectProps) {
  return (
    <div>
      <Select
        value={value ?? ''}
        onValueChange={(val) => onChange(val as ListingCondition)}
        disabled={disabled}
      >
        <SelectTrigger className={cn(error && 'border-destructive')}>
          <SelectValue placeholder="Select condition..." />
        </SelectTrigger>
        <SelectContent>
          {CONDITION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
