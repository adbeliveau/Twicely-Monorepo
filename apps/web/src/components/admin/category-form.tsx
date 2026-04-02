'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import { Checkbox } from '@twicely/ui/checkbox';
import { createCategory, updateCategory } from '@/lib/actions/admin-categories';

const FEE_BUCKETS = [
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'APPAREL_ACCESSORIES', label: 'Apparel & Accessories' },
  { value: 'HOME_GENERAL', label: 'Home & General' },
  { value: 'COLLECTIBLES_LUXURY', label: 'Collectibles & Luxury' },
] as const;

interface CategoryOption {
  id: string;
  name: string;
  depth: number;
}

interface CategoryFormData {
  name?: string;
  slug?: string;
  parentId?: string | null;
  description?: string | null;
  icon?: string | null;
  feeBucket?: string;
  sortOrder?: number;
  isActive?: boolean;
  isLeaf?: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

interface CategoryFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<CategoryFormData> & { id?: string };
  categories: CategoryOption[];
  onCancel?: () => void;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function CategoryForm({
  mode,
  initialData,
  categories,
  onCancel,
}: CategoryFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [parentId, setParentId] = useState<string>(initialData?.parentId ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [icon, setIcon] = useState(initialData?.icon ?? '');
  const [feeBucket, setFeeBucket] = useState(initialData?.feeBucket ?? 'HOME_GENERAL');
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [isLeaf, setIsLeaf] = useState(initialData?.isLeaf ?? false);
  const [metaTitle, setMetaTitle] = useState(initialData?.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(initialData?.metaDescription ?? '');

  function handleNameChange(val: string) {
    setName(val);
    if (mode === 'create') setSlug(slugify(val));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      name,
      slug,
      parentId: parentId || null,
      description: description || null,
      icon: icon || null,
      feeBucket,
      sortOrder,
      isActive,
      isLeaf,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
    };

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createCategory(payload);
        if (!result.success) { setError(result.error ?? 'Unknown error'); return; }
        router.push(`/categories/${result.data?.id}`);
      } else {
        const result = await updateCategory({ id: initialData?.id ?? '', ...payload });
        if (!result.success) { setError(result.error ?? 'Unknown error'); return; }
        if (onCancel) onCancel();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="cat-name">Name *</Label>
          <Input id="cat-name" value={name} onChange={(e) => handleNameChange(e.target.value)} required maxLength={100} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cat-slug">Slug *</Label>
          <Input id="cat-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="cat-parent">Parent Category</Label>
        <Select value={parentId} onValueChange={setParentId}>
          <SelectTrigger id="cat-parent">
            <SelectValue placeholder="None (root category)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None (root category)</SelectItem>
            {categories.filter((c) => c.id !== initialData?.id).map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {'  '.repeat(cat.depth)}{cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="cat-desc">Description</Label>
        <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="cat-icon">Icon</Label>
          <Input id="cat-icon" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={50} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cat-sort">Sort Order</Label>
          <Input id="cat-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="cat-feebucket">Fee Bucket <span className="text-xs text-gray-400">(Legacy — not used for transaction fee calculation)</span></Label>
        <Select value={feeBucket} onValueChange={setFeeBucket}>
          <SelectTrigger id="cat-feebucket">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEE_BUCKETS.map((fb) => (
              <SelectItem key={fb.value} value={fb.value}>{fb.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={isLeaf} onCheckedChange={(v) => setIsLeaf(Boolean(v))} />
          Leaf category <span className="text-xs text-gray-400">(cannot have subcategories)</span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="cat-metatitle">Meta Title <span className="text-xs text-gray-400">max 70</span></Label>
          <Input id="cat-metatitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={70} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cat-metadesc">Meta Description <span className="text-xs text-gray-400">max 160</span></Label>
          <Input id="cat-metadesc" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} maxLength={160} />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : mode === 'create' ? 'Create Category' : 'Save Changes'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
