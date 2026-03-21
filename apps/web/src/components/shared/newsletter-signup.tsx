'use client';

import { useState } from 'react';
import { Input } from '@twicely/ui/input';
import { Button } from '@twicely/ui/button';

type Source = 'HOMEPAGE_SECTION' | 'HOMEPAGE_FOOTER';
type Status = 'idle' | 'loading' | 'success' | 'error' | 'already_subscribed';

interface Props {
  source: Source;
}

export function NewsletterSignup({ source }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email, source }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = (await res.json()) as { success: boolean; alreadySubscribed?: boolean; error?: string };

      if (data.success && data.alreadySubscribed) {
        setStatus('already_subscribed');
      } else if (data.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  }

  const isLoading = status === 'loading';

  return (
    <form aria-label="Newsletter signup" onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-2">
      <div className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <Input
          id="newsletter-email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          ) : (
            'Get updates'
          )}
        </Button>
      </div>
      <div aria-live="polite" className="text-sm">
        {status === 'success' && (
          <p className="text-green-600">Thanks! Check your inbox.</p>
        )}
        {status === 'already_subscribed' && (
          <p className="text-muted-foreground">You&apos;re already subscribed.</p>
        )}
        {status === 'error' && (
          <p className="text-destructive">{errorMessage}</p>
        )}
      </div>
    </form>
  );
}
