'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { formatCentsToDollars } from '@twicely/finance/format';
import {
  createMileageAction,
  updateMileageAction,
} from '@/lib/actions/finance-center-mileage';
import type { MileageRow } from '@/lib/queries/finance-center-mileage';

interface MileageFormProps {
  entry?: MileageRow;
  irsRate: number;
  onSuccess: () => void;
  onCancel: () => void;
}

function formatDateForInput(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function MileageForm({ entry, irsRate, onSuccess, onCancel }: MileageFormProps) {
  const isEdit = !!entry;
  const today = formatDateForInput(new Date());

  const [description, setDescription] = useState(entry?.description ?? '');
  const [milesStr, setMilesStr] = useState(
    entry ? entry.miles.toString() : '',
  );
  const [tripDate, setTripDate] = useState(
    entry ? formatDateForInput(entry.tripDate) : today,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const miles = parseFloat(milesStr);
  const previewDeductionCents =
    !isNaN(miles) && miles > 0
      ? Math.round(miles * irsRate * 100)
      : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const milesNum = parseFloat(milesStr);
    if (isNaN(milesNum) || milesNum <= 0) {
      setError('Miles must be a positive number');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    const tripDateIso = new Date(tripDate).toISOString();

    setLoading(true);
    try {
      if (isEdit && entry) {
        const result = await updateMileageAction({
          id: entry.id,
          description: description.trim(),
          miles: milesNum,
          tripDate: tripDateIso,
        });
        if (!result.success) {
          setError(result.error);
          return;
        }
      } else {
        const result = await createMileageAction({
          description: description.trim(),
          miles: milesNum,
          tripDate: tripDateIso,
        });
        if (!result.success) {
          setError(result.error);
          return;
        }
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Post office run, sourcing trip to thrift store"
          rows={2}
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="miles">Miles</Label>
        <Input
          id="miles"
          type="number"
          step="0.1"
          min="0.01"
          max="10000"
          placeholder="0.0"
          value={milesStr}
          onChange={(e) => setMilesStr(e.target.value)}
          required
        />
        {previewDeductionCents > 0 && (
          <p className="text-xs text-muted-foreground">
            {milesStr} mi &times; ${irsRate.toFixed(2)}/mi ={' '}
            <strong>{formatCentsToDollars(previewDeductionCents)}</strong>{' '}
            estimated deduction
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="tripDate">Trip date</Label>
        <Input
          id="tripDate"
          type="date"
          value={tripDate}
          onChange={(e) => setTripDate(e.target.value)}
          required
        />
      </div>

      <p className="text-xs text-muted-foreground">
        IRS rate: ${irsRate.toFixed(2)}/mile. Deduction is calculated
        server-side using the rate active at the time of entry.
      </p>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Log trip'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
