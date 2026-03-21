'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@twicely/ui/radio-group';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface SellerReturnResponseFormProps {
  returnId: string;
  reason: string;
}

export function SellerReturnResponseForm({ returnId, reason }: SellerReturnResponseFormProps) {
  const router = useRouter();
  const [decision, setDecision] = useState<'approve' | 'decline' | ''>('');
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seller fault reasons where declining isn't recommended
  const sellerFaultReasons = ['INAD', 'WRONG_ITEM', 'COUNTERFEIT'];
  const isSellerFault = sellerFaultReasons.includes(reason);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!decision) {
      setError('Please select a decision');
      return;
    }

    if (decision === 'decline' && !response.trim()) {
      setError('Please provide a reason for declining');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/returns/${returnId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: decision === 'approve',
          response: response.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit response');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-6 space-y-6">
      <h2 className="font-semibold">Respond to Return Request</h2>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isSellerFault && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> This return reason suggests an issue on the seller side.
            Declining may result in the buyer escalating to a dispute.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Label className="text-base font-medium">Your decision</Label>
        <RadioGroup value={decision} onValueChange={(v) => setDecision(v as 'approve' | 'decline')}>
          <label
            className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
              decision === 'approve' ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'
            }`}
          >
            <RadioGroupItem value="approve" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium">Approve Return</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Accept the return. The buyer will ship the item back, and a refund will be processed.
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
              decision === 'decline' ? 'border-red-500 bg-red-50' : 'hover:bg-gray-50'
            }`}
          >
            <RadioGroupItem value="decline" className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium">Decline Return</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Reject the return request. The buyer may escalate this to a dispute.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="response" className="text-base font-medium">
          {decision === 'decline' ? 'Reason for declining (required)' : 'Message to buyer (optional)'}
        </Label>
        <Textarea
          id="response"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder={
            decision === 'decline'
              ? 'Explain why you are declining this return...'
              : 'Add any additional information for the buyer...'
          }
          rows={4}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !decision}
          variant={decision === 'approve' ? 'default' : 'destructive'}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : decision === 'approve' ? (
            'Approve Return'
          ) : decision === 'decline' ? (
            'Decline Return'
          ) : (
            'Submit Response'
          )}
        </Button>
      </div>
    </form>
  );
}
