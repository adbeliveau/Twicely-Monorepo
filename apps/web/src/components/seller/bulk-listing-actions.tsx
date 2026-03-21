'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@twicely/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@twicely/ui/dialog';
import { ChevronDown, Play, Pause, Trash2, DollarSign, Check, X } from 'lucide-react';
import { bulkUpdateListingsAction } from '@/lib/actions/bulk-listings';

interface BulkListingActionsProps {
  selectedIds: string[];
  onComplete: () => void;
  onClear: () => void;
}

type ActionType = 'ACTIVATE' | 'DEACTIVATE' | 'DELETE' | 'PRICE_ADJUST';

export function BulkListingActions({ selectedIds, onComplete, onClear }: BulkListingActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);
  const [priceAdjustment, setPriceAdjustment] = useState({
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    value: '',
    direction: 'DECREASE' as 'INCREASE' | 'DECREASE',
  });
  const [result, setResult] = useState<{
    processed: number;
    failed: number;
    errors: Array<{ listingId: string; error: string }>;
  } | null>(null);

  const handleAction = (action: ActionType) => {
    if (action === 'PRICE_ADJUST') {
      setPriceDialogOpen(true);
      return;
    }
    setPendingAction(action);
    setConfirmDialogOpen(true);
  };

  const executeAction = () => {
    if (!pendingAction) return;

    const priceParams = pendingAction === 'PRICE_ADJUST' && priceAdjustment.value
      ? {
          type: priceAdjustment.type,
          value: priceAdjustment.type === 'PERCENTAGE'
            ? parseFloat(priceAdjustment.value)
            : Math.round(parseFloat(priceAdjustment.value) * 100),
          direction: priceAdjustment.direction,
        }
      : undefined;

    startTransition(async () => {
      const res = await bulkUpdateListingsAction(selectedIds, pendingAction, priceParams);
      setResult({ processed: res.processed, failed: res.failed, errors: res.errors });
      setConfirmDialogOpen(false);
      setPriceDialogOpen(false);

      if (res.success) {
        onComplete();
        onClear();
      }
    });
  };

  const actionLabels: Record<ActionType, { label: string; icon: React.ReactNode }> = {
    ACTIVATE: { label: 'Activate', icon: <Play className="mr-2 h-4 w-4" /> },
    DEACTIVATE: { label: 'Pause', icon: <Pause className="mr-2 h-4 w-4" /> },
    DELETE: { label: 'End', icon: <Trash2 className="mr-2 h-4 w-4" /> },
    PRICE_ADJUST: { label: 'Adjust Price', icon: <DollarSign className="mr-2 h-4 w-4" /> },
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
        <span className="text-sm font-medium">{selectedIds.length} selected</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Actions
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleAction('ACTIVATE')}>
              <Play className="mr-2 h-4 w-4" />
              Activate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction('DEACTIVATE')}>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleAction('PRICE_ADJUST')}>
              <DollarSign className="mr-2 h-4 w-4" />
              Adjust Price
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleAction('DELETE')}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              End Listings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Price Adjustment Dialog */}
      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Price</DialogTitle>
            <DialogDescription>
              Adjust the price of {selectedIds.length} listing(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="direction"
                  checked={priceAdjustment.direction === 'DECREASE'}
                  onChange={() => setPriceAdjustment({ ...priceAdjustment, direction: 'DECREASE' })}
                />
                Decrease
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="direction"
                  checked={priceAdjustment.direction === 'INCREASE'}
                  onChange={() => setPriceAdjustment({ ...priceAdjustment, direction: 'INCREASE' })}
                />
                Increase
              </label>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  checked={priceAdjustment.type === 'PERCENTAGE'}
                  onChange={() => setPriceAdjustment({ ...priceAdjustment, type: 'PERCENTAGE' })}
                />
                Percentage
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  checked={priceAdjustment.type === 'FIXED'}
                  onChange={() => setPriceAdjustment({ ...priceAdjustment, type: 'FIXED' })}
                />
                Fixed Amount
              </label>
            </div>

            <div>
              <Label htmlFor="value">
                {priceAdjustment.type === 'PERCENTAGE' ? 'Percentage' : 'Amount ($)'}
              </Label>
              <Input
                id="value"
                type="number"
                step={priceAdjustment.type === 'PERCENTAGE' ? '1' : '0.01'}
                min="0"
                max={priceAdjustment.type === 'PERCENTAGE' ? '100' : undefined}
                placeholder={priceAdjustment.type === 'PERCENTAGE' ? '10' : '5.00'}
                value={priceAdjustment.value}
                onChange={(e) => setPriceAdjustment({ ...priceAdjustment, value: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPendingAction('PRICE_ADJUST');
                setConfirmDialogOpen(true);
              }}
              disabled={!priceAdjustment.value}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Confirm {pendingAction ? actionLabels[pendingAction].label : ''}
            </DialogTitle>
            <DialogDescription>
              This will {pendingAction?.toLowerCase()} {selectedIds.length} listing(s).
              {pendingAction === 'DELETE' && ' This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                {result.processed} processed successfully
              </div>
              {result.failed > 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <X className="h-4 w-4" />
                  {result.failed} failed
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={executeAction}
              disabled={isPending}
              variant={pendingAction === 'DELETE' ? 'destructive' : 'default'}
            >
              {isPending ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
