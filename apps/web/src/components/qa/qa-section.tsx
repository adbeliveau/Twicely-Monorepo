import { getQuestionsForListing } from '@/lib/queries/qa';
import { QaPanel } from './qa-panel';

interface QaSectionProps {
  listingId: string;
  currentUserId: string | null;
  isOwnListing: boolean;
  isListingActive: boolean;
}

export async function QaSection({
  listingId,
  currentUserId,
  isOwnListing,
  isListingActive,
}: QaSectionProps) {
  const questions = await getQuestionsForListing(listingId);

  if (questions.length === 0 && isOwnListing) {
    return null;
  }

  return (
    <QaPanel
      listingId={listingId}
      currentUserId={currentUserId}
      isOwnListing={isOwnListing}
      initialQuestions={questions}
      isListingActive={isListingActive}
    />
  );
}
