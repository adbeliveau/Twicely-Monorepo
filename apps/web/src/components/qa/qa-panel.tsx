'use client';

import Link from 'next/link';
import { QaQuestionCard } from './qa-question-card';
import { AskQuestionForm } from './ask-question-form';
import { shouldShowAskForm, getQuestionCountLabel } from './qa-helpers';
import type { QuestionSummary } from '@/lib/queries/qa';

interface QaPanelProps {
  listingId: string;
  currentUserId: string | null;
  isOwnListing: boolean;
  initialQuestions: QuestionSummary[];
  isListingActive: boolean;
}

export function QaPanel({
  listingId,
  currentUserId,
  isOwnListing,
  initialQuestions,
  isListingActive,
}: QaPanelProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">
        {getQuestionCountLabel(initialQuestions.length)}
      </h2>

      {shouldShowAskForm(currentUserId, isOwnListing) && isListingActive && (
        <AskQuestionForm listingId={listingId} />
      )}

      {currentUserId === null && (
        <p className="text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>{' '}
          to ask a question
        </p>
      )}

      {initialQuestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No questions yet. Be the first to ask!
        </p>
      ) : (
        <div className="space-y-3">
          {initialQuestions.map((question) => (
            <QaQuestionCard
              key={question.id}
              question={question}
              isOwnListing={isOwnListing}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
