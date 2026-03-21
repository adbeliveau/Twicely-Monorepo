'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Textarea } from '@twicely/ui/textarea';
import { answerQuestion } from '@/lib/actions/qa';
import { isSubmitDisabled } from './qa-helpers';

interface AnswerQuestionFormProps {
  questionId: string;
  onCancel: () => void;
}

const MAX_LENGTH = 1000;

export function AnswerQuestionForm({ questionId, onCancel }: AnswerQuestionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [answerText, setAnswerText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await answerQuestion({ questionId, answerText });
      if (result.success) {
        router.refresh();
        onCancel();
      } else {
        setError(result.error ?? 'Failed to submit answer');
      }
    });
  };

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        placeholder="Write your answer..."
        value={answerText}
        onChange={(e) => setAnswerText(e.target.value)}
        disabled={isPending}
        rows={3}
      />
      <p className="text-xs text-muted-foreground text-right">
        {answerText.length}/{MAX_LENGTH}
      </p>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitDisabled(answerText, MAX_LENGTH, isPending)}
        >
          {isPending ? 'Submitting...' : 'Submit Answer'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
