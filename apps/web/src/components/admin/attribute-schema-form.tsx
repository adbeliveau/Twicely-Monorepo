'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Checkbox } from '@twicely/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import { Textarea } from '@twicely/ui/textarea';
import { createAttributeSchema, updateAttributeSchema } from '@/lib/actions/admin-categories';
import type { AdminCategoryDetail } from '@/lib/queries/admin-categories';

type SchemaRow = AdminCategoryDetail['attributeSchemas'][number];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'number', label: 'Number' },
] as const;

interface AttributeSchemaFormProps {
  mode: 'create' | 'edit';
  categoryId: string;
  initialData?: SchemaRow;
  onDone: () => void;
}

export function AttributeSchemaForm({
  mode,
  categoryId,
  initialData,
  onDone,
}: AttributeSchemaFormProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name ?? '');
  const [label, setLabel] = useState(initialData?.label ?? '');
  const [fieldType, setFieldType] = useState(initialData?.fieldType ?? 'text');
  const [isRequired, setIsRequired] = useState(initialData?.isRequired ?? false);
  const [isRecommended, setIsRecommended] = useState(initialData?.isRecommended ?? false);
  const [showInFilters, setShowInFilters] = useState(initialData?.showInFilters ?? false);
  const [showInListing, setShowInListing] = useState(initialData?.showInListing ?? true);
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0);
  const [optionsText, setOptionsText] = useState(() => {
    if (!initialData?.optionsJson) return '';
    const opts = initialData.optionsJson;
    return Array.isArray(opts) ? (opts as string[]).join('\n') : '';
  });

  const showOptions = fieldType === 'select' || fieldType === 'multi_select';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const optionsJson = showOptions
      ? optionsText.split('\n').map((s) => s.trim()).filter(Boolean)
      : [];

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createAttributeSchema({
          categoryId,
          name,
          label,
          fieldType,
          isRequired,
          isRecommended,
          showInFilters,
          showInListing,
          optionsJson,
          validationJson: {},
          sortOrder,
        });
        if (!result.success) { setError(result.error ?? 'Unknown error'); return; }
      } else {
        const result = await updateAttributeSchema({
          id: initialData!.id,
          name,
          label,
          fieldType,
          isRequired,
          isRecommended,
          showInFilters,
          showInListing,
          optionsJson,
          sortOrder,
        });
        if (!result.success) { setError(result.error ?? 'Unknown error'); return; }
      }
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="as-name">Name *</Label>
          <Input id="as-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="brand" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="as-label">Label *</Label>
          <Input id="as-label" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={100} placeholder="Brand" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="as-type">Field Type *</Label>
          <Select value={fieldType} onValueChange={setFieldType}>
            <SelectTrigger id="as-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((ft) => (
                <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="as-sort">Sort Order</Label>
          <Input id="as-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        </div>
      </div>

      {showOptions && (
        <div className="space-y-1">
          <Label htmlFor="as-options">Options <span className="text-xs text-gray-400">(one per line)</span></Label>
          <Textarea
            id="as-options"
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={4}
            placeholder="Option A&#10;Option B&#10;Option C"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={isRequired} onCheckedChange={(v) => setIsRequired(Boolean(v))} />
          Required
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={isRecommended} onCheckedChange={(v) => setIsRecommended(Boolean(v))} />
          Recommended
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={showInFilters} onCheckedChange={(v) => setShowInFilters(Boolean(v))} />
          Show in Filters
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={showInListing} onCheckedChange={(v) => setShowInListing(Boolean(v))} />
          Show in Listing
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : mode === 'create' ? 'Add Schema' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
