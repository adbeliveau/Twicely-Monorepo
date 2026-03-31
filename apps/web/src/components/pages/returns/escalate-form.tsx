'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Textarea } from '@twicely/ui/textarea';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { escalateToDisputeAction } from '@/lib/actions/dispute-escalation';

interface EscalateFormProps {
  returnId: string;
}

/**
 * Inline escalation form on the return detail page.
 * Allows buyer to escalate a declined return to a platform dispute
 * with a description of why they believe the decision was unfair.
 */
export function EscalateForm({ returnId }: EscalateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (description.trim().length < 10) {
      setError('Please provide at least 10 characters explaining why you want to escalate');
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await escalateToDisputeAction({
        returnId,
        description: description.trim(),
      });

      if (result.success && result.disputeId) {
        router.push(`/my/disputes/${result.disputeId}`);
      } else {
        setError(result.error ?? 'Failed to escalate');
      }
    });
  }

  if (!showForm) {
    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 mb-6">
        <h3 className="font-medium text-orange-800 mb-2">Not satisfied with the outcome?</h3>
        <p className="text-sm text-orange-700 mb-3">
          If you believe the seller&apos;s decision was unfair, you can escalate this to our team for review.
        </p>
        <Button
          variant="outline"
          className="border-orange-300 text-orange-700 hover:bg-orange-100"
          onClick={() => setShowForm(true)}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Escalate to Dispute
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 mb-6 space-y-3">
      <h3 className="font-medium text-orange-800">Escalate to Dispute</h3>
      <p className="text-sm text-orange-700">
        Please explain why you believe the seller&apos;s response was unfair.
        Our team will review both sides and make a decision.
      </p>

      {error && (
        <div className="rounded bg-red-100 p-3 text-sm text-red-800">{error}</div>
      )}

      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe why you want to escalate this return..."
        rows={4}
        disabled={isPending}
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setShowForm(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isPending || description.trim().length < 10}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Submit Escalation
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
