'use client';

/**
 * ProjectionOverridesDialog — per-channel override editor (title, description, price).
 * Source: F3 install prompt §3.8
 */

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@twicely/ui/dialog';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Textarea } from '@twicely/ui/textarea';
import { Label } from '@twicely/ui/label';
import { updateProjectionOverrides } from '@/lib/actions/crosslister-publish';
import { CHANNEL_REGISTRY } from '@twicely/crosslister/channel-registry';
import type { ChannelProjection } from '@twicely/crosslister/db-types';
import type { ExternalChannel } from '@twicely/crosslister/types';

interface ProjectionOverridesDialogProps {
  projection: ChannelProjection;
  canonicalTitle: string | null;
  canonicalDescription: string | null;
  canonicalPriceCents: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ProjectionOverridesDialog({
  projection,
  canonicalTitle,
  canonicalDescription,
  canonicalPriceCents,
  open,
  onOpenChange,
  onSaved,
}: ProjectionOverridesDialogProps) {
  const channel = projection.channel as ExternalChannel;
  const metadata = CHANNEL_REGISTRY.get(channel);
  const caps = metadata?.defaultCapabilities;

  const overrides = projection.overridesJson as Record<string, unknown>;

  const [title, setTitle] = useState<string>(String(overrides['titleOverride'] ?? ''));
  const [description, setDescription] = useState<string>(String(overrides['descriptionOverride'] ?? ''));
  const [priceStr, setPriceStr] = useState<string>(
    overrides['priceCentsOverride'] !== undefined && overrides['priceCentsOverride'] !== null
      ? (Number(overrides['priceCentsOverride']) / 100).toFixed(2)
      : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClear() {
    setTitle('');
    setDescription('');
    setPriceStr('');
  }

  function handleSave() {
    setError(null);
    const priceCentsOverride = priceStr !== '' ? Math.round(parseFloat(priceStr) * 100) : null;
    if (priceStr !== '' && (isNaN(priceCentsOverride!) || priceCentsOverride! < 1)) {
      setError('Price must be a valid amount greater than $0.00');
      return;
    }

    startTransition(async () => {
      const result = await updateProjectionOverrides({
        projectionId: projection.id,
        titleOverride: title !== '' ? title : null,
        descriptionOverride: description !== '' ? description : null,
        priceCentsOverride: priceStr !== '' ? (priceCentsOverride ?? null) : null,
      });
      if (!result.success) {
        setError(result.error ?? 'Failed to save overrides');
        return;
      }
      onSaved();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Override for {metadata?.displayName ?? channel}</DialogTitle>
          <DialogDescription>
            Set custom values for this platform. Leave blank to use the canonical listing values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="title-override">
              Title override
              {caps ? <span className="text-muted-foreground text-xs ml-1">(max {caps.maxTitleLength} characters)</span> : null}
            </Label>
            <Input
              id="title-override"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={caps?.maxTitleLength}
              placeholder={canonicalTitle ?? 'Canonical title'}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="desc-override">
              Description override
              {caps ? <span className="text-muted-foreground text-xs ml-1">(max {caps.maxDescriptionLength} characters)</span> : null}
            </Label>
            <Textarea
              id="desc-override"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={caps?.maxDescriptionLength}
              placeholder={canonicalDescription ?? 'Canonical description'}
              rows={4}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="price-override">Price override (USD)</Label>
            <Input
              id="price-override"
              type="number"
              step="0.01"
              min="0.01"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder={canonicalPriceCents !== null ? (canonicalPriceCents / 100).toFixed(2) : 'Canonical price'}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClear} disabled={isPending}>
            Clear overrides
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save overrides'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
