'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { Switch } from '@twicely/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@twicely/ui/select';
import { createFeatureFlagAction, updateFeatureFlagAction } from '@/lib/actions/admin-feature-flags';
import type { FeatureFlagRow } from '@/lib/queries/admin-feature-flags';

interface FeatureFlagFormProps {
  initialData?: FeatureFlagRow;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FeatureFlagForm({ initialData, onSuccess, onCancel }: FeatureFlagFormProps) {
  const isEdit = !!initialData;
  const [key, setKey] = useState(initialData?.key ?? '');
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [type, setType] = useState<'BOOLEAN' | 'PERCENTAGE' | 'TARGETED'>(initialData?.type ?? 'BOOLEAN');
  const [enabled, setEnabled] = useState(initialData?.enabled ?? false);
  const [percentage, setPercentage] = useState(initialData?.percentage ?? 50);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isEdit && initialData) {
        const result = await updateFeatureFlagAction({
          flagId: initialData.id,
          name,
          description: description || undefined,
          enabled,
          percentage: type === 'PERCENTAGE' ? percentage : undefined,
        });
        if ('error' in result) { setError(result.error ?? null); return; }
      } else {
        const result = await createFeatureFlagAction({
          key,
          name,
          description: description || undefined,
          type,
          enabled,
          percentage: type === 'PERCENTAGE' ? percentage : undefined,
        });
        if ('error' in result) { setError(result.error ?? null); return; }
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!isEdit && (
        <div className="space-y-1">
          <Label htmlFor="flagKey">Key</Label>
          <Input
            id="flagKey"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="feature.newCheckout"
            className="font-mono text-sm"
            required
          />
          <p className="text-xs text-muted-foreground">Dotted lowercase (e.g. feature.newCheckout)</p>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="flagName">Name</Label>
        <Input
          id="flagName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New Checkout Flow"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="flagDesc">Description (optional)</Label>
        <Textarea
          id="flagDesc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this flag"
          rows={2}
        />
      </div>

      {!isEdit && (
        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BOOLEAN">Boolean</SelectItem>
              <SelectItem value="PERCENTAGE">Percentage</SelectItem>
              <SelectItem value="TARGETED">Targeted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Switch id="flagEnabled" checked={enabled} onCheckedChange={setEnabled} />
        <Label htmlFor="flagEnabled">Enabled</Label>
      </div>

      {type === 'PERCENTAGE' && (
        <div className="space-y-1">
          <Label htmlFor="flagPct">Rollout Percentage</Label>
          <div className="flex items-center gap-3">
            <Input
              id="flagPct"
              type="number"
              min={0}
              max={100}
              value={percentage}
              onChange={(e) => setPercentage(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">{percentage}% of users</span>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Flag'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
