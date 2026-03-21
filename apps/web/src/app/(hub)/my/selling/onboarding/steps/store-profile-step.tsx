'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Loader2 } from 'lucide-react';
import { updateStoreNameAction } from '@/lib/actions/seller-onboarding';

interface StoreProfileStepProps {
  existingStoreName: string | null;
  existingStoreSlug: string | null;
  onComplete: () => void;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30);
}

export function StoreProfileStep({
  existingStoreName,
  existingStoreSlug,
  onComplete,
}: StoreProfileStepProps) {
  const [storeName, setStoreName] = useState(existingStoreName ?? '');
  const [storeSlug, setStoreSlug] = useState(existingStoreSlug ?? '');
  const [slugEdited, setSlugEdited] = useState(!!existingStoreSlug);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-generate slug from store name (debounced)
  useEffect(() => {
    if (slugEdited) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setStoreSlug(slugify(storeName));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [storeName, slugEdited]);

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setStoreSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await updateStoreNameAction({ storeName, storeSlug });

    setIsLoading(false);
    if (result.success) {
      onComplete();
    } else {
      setError(result.error ?? 'Something went wrong');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store Profile</CardTitle>
        <CardDescription>
          Choose a name and URL for your Twicely store. You can update these later in store
          settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="space-y-1">
            <Label htmlFor="storeName">Store Name</Label>
            <Input
              id="storeName"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="My Vintage Shop"
              minLength={2}
              maxLength={50}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="storeSlug">Store URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                twicely.co/st/
              </span>
              <Input
                id="storeSlug"
                value={storeSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="my-vintage-shop"
                minLength={2}
                maxLength={30}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Only lowercase letters, numbers, and hyphens allowed.
            </p>
          </div>

          <Button type="submit" disabled={isLoading || !storeName || !storeSlug} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
