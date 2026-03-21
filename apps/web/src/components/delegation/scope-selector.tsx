'use client';

import { useState } from 'react';
import { Checkbox } from '@twicely/ui/checkbox';
import { Label } from '@twicely/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import { SCOPE_CATEGORIES, SCOPE_LABELS, ROLE_PRESETS } from '@/lib/delegation/constants';
import type { DelegationScope } from '@twicely/casl/types';

type ScopeSelectorProps = {
  selectedScopes: string[];
  onChange: (scopes: string[]) => void;
  disabled?: boolean;
};

type PresetKey = keyof typeof ROLE_PRESETS | 'CUSTOM' | '';

function getScopesMatchPreset(scopes: string[]): PresetKey {
  const sorted = [...scopes].sort().join(',');
  for (const [key, presetScopes] of Object.entries(ROLE_PRESETS)) {
    if ([...presetScopes].sort().join(',') === sorted) {
      return key as PresetKey;
    }
  }
  return scopes.length > 0 ? 'CUSTOM' : '';
}

export function ScopeSelector({ selectedScopes, onChange, disabled }: ScopeSelectorProps) {
  const [preset, setPreset] = useState<PresetKey>(() => getScopesMatchPreset(selectedScopes));

  function handlePresetChange(value: string) {
    if (value in ROLE_PRESETS) {
      const presetKey = value as keyof typeof ROLE_PRESETS;
      setPreset(presetKey);
      onChange([...ROLE_PRESETS[presetKey]] as string[]);
    }
  }

  function handleScopeToggle(scope: DelegationScope, checked: boolean) {
    const next = checked
      ? [...selectedScopes, scope]
      : selectedScopes.filter((s) => s !== scope);
    setPreset(getScopesMatchPreset(next));
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="role-preset">Role preset</Label>
        <Select
          value={preset}
          onValueChange={handlePresetChange}
          disabled={disabled}
        >
          <SelectTrigger id="role-preset" className="w-48">
            <SelectValue placeholder="Select a preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="FULFILLMENT">Fulfillment</SelectItem>
            <SelectItem value="FINANCE">Finance</SelectItem>
            <SelectItem value="SUPPORT">Support</SelectItem>
            <SelectItem value="READ_ONLY">Read Only</SelectItem>
            {preset === 'CUSTOM' && <SelectItem value="CUSTOM">Custom</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {SCOPE_CATEGORIES.map((category) => (
          <div key={category.label}>
            <p className="text-sm font-medium text-muted-foreground mb-1">{category.label}</p>
            <div className="space-y-1 pl-1">
              {category.scopes.map((scope) => (
                <div key={scope} className="flex items-center gap-2">
                  <Checkbox
                    id={`scope-${scope}`}
                    checked={selectedScopes.includes(scope)}
                    onCheckedChange={(checked) =>
                      handleScopeToggle(scope, checked === true)
                    }
                    disabled={disabled}
                  />
                  <Label htmlFor={`scope-${scope}`} className="text-sm font-normal">
                    {SCOPE_LABELS[scope]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
