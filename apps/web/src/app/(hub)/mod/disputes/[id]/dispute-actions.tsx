'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import {
  assignDisputeAction,
  resolveDisputeAction,
  processProtectionClaimAction,
} from '@/lib/actions/disputes';
import type { DisputeResolution } from '@twicely/commerce/disputes';

interface DisputeActionsProps {
  disputeId: string;
  status: string;
  isAssigned: boolean;
  orderTotalCents: number;
}

export function DisputeActions({
  disputeId,
  status,
  isAssigned,
  orderTotalCents,
}: DisputeActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  const handleAssign = async () => {
    setLoading(true);
    setError(null);
    const result = await assignDisputeAction(disputeId);
    if (!result.success) {
      setError(result.error ?? 'Failed to assign');
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  const handleResolve = async (resolution: DisputeResolution) => {
    if (!resolutionNote.trim()) {
      setError('Resolution note is required');
      return;
    }

    setLoading(true);
    setError(null);

    const amountCents = resolution === 'RESOLVED_PARTIAL' && refundAmount
      ? Math.round(parseFloat(refundAmount) * 100)
      : resolution === 'RESOLVED_BUYER'
      ? orderTotalCents
      : undefined;

    const result = await resolveDisputeAction(
      disputeId,
      resolution,
      resolutionNote,
      amountCents
    );

    if (!result.success) {
      setError(result.error ?? 'Failed to resolve');
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  const handleProcessClaim = async (approved: boolean) => {
    if (!resolutionNote.trim()) {
      setError('Resolution note is required');
      return;
    }

    setLoading(true);
    setError(null);

    const amountCents = approved && refundAmount
      ? Math.round(parseFloat(refundAmount) * 100)
      : approved
      ? orderTotalCents
      : undefined;

    const result = await processProtectionClaimAction(
      disputeId,
      approved,
      resolutionNote,
      amountCents
    );

    if (!result.success) {
      setError(result.error ?? 'Failed to process claim');
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Show assign button if not yet assigned
  if (status === 'OPEN' && !isAssigned) {
    return (
      <div className="pt-4 border-t">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Actions</h3>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <Button onClick={handleAssign} disabled={loading}>
          {loading ? 'Assigning...' : 'Assign to Me'}
        </Button>
      </div>
    );
  }

  // Show resolution form if assigned
  if (isAssigned) {
    return (
      <div className="pt-4 border-t space-y-4">
        <h3 className="text-sm font-medium text-gray-500">Resolve Dispute</h3>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Resolution Note (required)
          </label>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            className="w-full p-3 border rounded-lg text-sm min-h-[100px]"
            placeholder="Explain the resolution decision..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custom Refund Amount (optional, defaults to full order: {formatPrice(orderTotalCents)})
          </label>
          <input
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            className="w-full p-3 border rounded-lg text-sm"
            placeholder="Enter amount in dollars"
            step="0.01"
            min="0"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={() => handleResolve('RESOLVED_BUYER')}
            disabled={loading}
          >
            Full Refund to Buyer
          </Button>
          <Button
            onClick={() => handleResolve('RESOLVED_PARTIAL')}
            disabled={loading || !refundAmount}
            variant="secondary"
          >
            Partial Refund
          </Button>
          <Button
            onClick={() => handleResolve('RESOLVED_SELLER')}
            disabled={loading}
            variant="outline"
          >
            No Refund (Seller Wins)
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            onClick={() => handleProcessClaim(true)}
            disabled={loading}
          >
            Approve Protection Claim
          </Button>
          <Button
            onClick={() => handleProcessClaim(false)}
            disabled={loading}
            variant="destructive"
          >
            Deny Protection Claim
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
