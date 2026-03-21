'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Textarea } from '@twicely/ui/textarea';
import { askQuestion } from '@/lib/actions/qa';
import { isSubmitDisabled } from './qa-helpers';

interface AskQuestionFormProps {
  listingId: string;
}

const MAX_LENGTH = 500;

export function AskQuestionForm({ listingId }: AskQuestionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [questionText, setQuestionText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await askQuestion({ listingId, questionText });
      if (result.success) {
        setQuestionText('');
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to submit question');
      }
    });
  };

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Ask the seller a question..."
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        disabled={isPending}
        rows={3}
      />
      <p className="text-xs text-muted-foreground text-right">
        {questionText.length}/{MAX_LENGTH}
      </p>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={isSubmitDisabled(questionText, MAX_LENGTH, isPending)}
      >
        {isPending ? 'Submitting...' : 'Ask Question'}
      </Button>
    </div>
  );
}
