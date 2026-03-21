'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pin, EyeOff } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { formatDate } from '@twicely/utils/format';
import { pinQuestion, hideQuestion } from '@/lib/actions/qa';
import { AnswerQuestionForm } from './answer-question-form';
import type { QuestionSummary } from '@/lib/queries/qa';

interface QaQuestionCardProps {
  question: QuestionSummary;
  isOwnListing: boolean;
  currentUserId: string | null;
}

export function QaQuestionCard({ question, isOwnListing }: QaQuestionCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAnswerForm, setShowAnswerForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handlePin = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await pinQuestion({ questionId: question.id, isPinned: !question.isPinned });
      if (result.success) {
        router.refresh();
      } else {
        setActionError(result.error ?? 'Failed to update pin');
      }
    });
  };

  const handleHide = () => {
    if (!window.confirm('Hide this question? It will no longer be visible to buyers.')) return;
    setActionError(null);
    startTransition(async () => {
      const result = await hideQuestion({ questionId: question.id });
      if (result.success) {
        router.refresh();
      } else {
        setActionError(result.error ?? 'Failed to hide question');
      }
    });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {question.isPinned && (
            <Pin className="size-3.5 shrink-0 text-primary" aria-label="Pinned" />
          )}
          <span className="text-sm font-medium truncate">{question.askerName}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDate(question.createdAt, 'relative')}
          </span>
        </div>
        {isOwnListing && (
          <div className="flex items-center gap-1 shrink-0">
            {!question.answerText && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => setShowAnswerForm((v) => !v)}
                disabled={isPending}
              >
                Answer
              </Button>
            )}
            <Button
              size="xs"
              variant="ghost"
              onClick={handlePin}
              disabled={isPending}
              title={question.isPinned ? 'Unpin' : 'Pin'}
            >
              <Pin className="size-3" />
              <span className="sr-only">{question.isPinned ? 'Unpin' : 'Pin'}</span>
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={handleHide}
              disabled={isPending}
              title="Hide"
            >
              <EyeOff className="size-3" />
              <span className="sr-only">Hide</span>
            </Button>
          </div>
        )}
      </div>

      <p className="text-sm">{question.questionText}</p>

      {question.answerText ? (
        <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
          <p className="text-xs text-muted-foreground">
            Seller answered {formatDate(question.answeredAt!, 'relative')}
          </p>
          <p className="text-sm">{question.answerText}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Awaiting seller&#39;s answer</p>
      )}

      {showAnswerForm && (
        <AnswerQuestionForm
          questionId={question.id}
          onCancel={() => setShowAnswerForm(false)}
        />
      )}

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}
    </div>
  );
}
