'use client';

import { useState, useTransition } from 'react';
import { Input } from '@twicely/ui/input';
import { Button } from '@twicely/ui/button';
import { confirmReceiptManualAction } from '@/lib/actions/local-transaction';

interface ManualCodeEntryProps {
  localTransactionId: string;
  onSuccess?: () => void;
}

/**
 * Buyer's fallback confirmation: enter the seller's 6-digit offline code.
 * Called when camera scanning isn't available (CODE_ONLINE mode).
 */
export function ManualCodeEntry({ localTransactionId, onSuccess }: ManualCodeEntryProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    startTransition(async () => {
      const result = await confirmReceiptManualAction({
        localTransactionId,
        sellerOfflineCode: code,
      });

      if (!result.success) {
        setError(result.error ?? 'Invalid code. Please try again.');
      } else {
        onSuccess?.();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label
          htmlFor="offline-code"
          className="text-sm font-medium text-foreground"
        >
          Enter seller&apos;s 6-digit code
        </label>
        <Input
          id="offline-code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={handleChange}
          className="font-mono text-center text-lg tracking-widest w-40"
          aria-describedby={error ? 'code-error' : undefined}
        />
        {error && (
          <p id="code-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={code.length !== 6 || isPending}
      >
        {isPending ? 'Confirming…' : 'Confirm Receipt'}
      </Button>
    </form>
  );
}
