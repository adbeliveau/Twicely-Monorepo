'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelOrderAction } from '@/lib/actions/orders';
import { Button } from '@twicely/ui/button';

interface CancelOrderFormProps {
  orderId: string;
}

const CANCEL_REASONS = [
  { value: '', label: 'Select a reason...', disabled: true },
  { value: 'OUT_OF_STOCK', label: 'Out of stock', disabled: false },
  { value: 'BUYER_REQUESTED', label: 'Buyer requested cancellation', disabled: false },
  { value: 'ITEM_DAMAGED', label: 'Item damaged before shipping', disabled: false },
  { value: 'PRICING_ERROR', label: 'Pricing error', disabled: false },
  { value: 'CANNOT_SHIP', label: 'Cannot ship to address', disabled: false },
  { value: 'OTHER', label: 'Other', disabled: false },
];

export function CancelOrderForm({ orderId }: CancelOrderFormProps) {
  const router = useRouter();
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate
    if (!selectedReason) {
      setError('Please select a cancellation reason');
      return;
    }

    if (selectedReason === 'OTHER') {
      if (!customReason.trim()) {
        setError('Please explain the reason for cancellation');
        return;
      }
      if (customReason.trim().length < 10) {
        setError('Custom reason must be at least 10 characters');
        return;
      }
      if (customReason.trim().length > 500) {
        setError('Custom reason must not exceed 500 characters');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Build final reason string
      const finalReason = selectedReason === 'OTHER'
        ? `OTHER: ${customReason.trim()}`
        : selectedReason;

      const result = await cancelOrderAction(orderId, finalReason);

      if (!result.success) {
        setError(result.error ?? 'Failed to cancel order');
        setIsSubmitting(false);
        return;
      }

      // Success - refresh the page to show updated order status
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Reason dropdown */}
      <div>
        <label htmlFor="cancelReason" className="block text-sm font-medium text-gray-700 mb-2">
          Cancel Reason *
        </label>
        <select
          id="cancelReason"
          value={selectedReason}
          onChange={(e) => {
            setSelectedReason(e.target.value);
            if (e.target.value !== 'OTHER') {
              setCustomReason(''); // Clear custom reason when switching away from OTHER
            }
          }}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          required
        >
          {CANCEL_REASONS.map((reason) => (
            <option key={reason.value} value={reason.value} disabled={reason.disabled}>
              {reason.label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom reason textarea (only shown when OTHER is selected) */}
      {selectedReason === 'OTHER' && (
        <div>
          <label htmlFor="customReason" className="block text-sm font-medium text-gray-700 mb-2">
            Please Explain *
          </label>
          <textarea
            id="customReason"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Please explain..."
            minLength={10}
            maxLength={500}
            required
            rows={3}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            10-500 characters required
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        variant="outline"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Canceling...' : 'Cancel Order'}
      </Button>
    </form>
  );
}
