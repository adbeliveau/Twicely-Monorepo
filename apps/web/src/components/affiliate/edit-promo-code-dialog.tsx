'use client';

import { useState, useTransition } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@twicely/ui/dialog';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Checkbox } from '@twicely/ui/checkbox';
import { updateAffiliatePromoCode } from '@/lib/actions/promo-codes-affiliate';
import type { PromoCodeRow } from '@/lib/queries/promo-codes';

interface EditPromoCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoCode: PromoCodeRow;
}

export function EditPromoCodeDialog({
  open,
  onOpenChange,
  promoCode,
}: EditPromoCodeDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(promoCode.isActive);
  const [usageLimit, setUsageLimit] = useState(
    promoCode.usageLimit !== null ? String(promoCode.usageLimit) : '',
  );
  const [expiresAt, setExpiresAt] = useState(
    promoCode.expiresAt
      ? new Date(promoCode.expiresAt).toISOString().slice(0, 16)
      : '',
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const usageLimitNum = usageLimit ? parseInt(usageLimit, 10) : null;
    const expiresAtVal = expiresAt ? new Date(expiresAt).toISOString() : null;

    startTransition(async () => {
      const result = await updateAffiliatePromoCode({
        id: promoCode.id,
        isActive,
        usageLimit: usageLimitNum,
        expiresAt: expiresAtVal,
      });

      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error ?? 'An error occurred');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Promo Code: {promoCode.code}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="usageLimit">Usage Limit (empty = unlimited)</Label>
            <Input
              id="usageLimit"
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="Unlimited"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="expiresAt">Expires At (empty = never)</Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
