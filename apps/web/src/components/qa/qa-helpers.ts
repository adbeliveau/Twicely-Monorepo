export function shouldShowAskForm(currentUserId: string | null, isOwnListing: boolean): boolean {
  return currentUserId !== null && !isOwnListing;
}

export function shouldShowSellerActions(isOwnListing: boolean): boolean {
  return isOwnListing;
}

export function getQuestionCountLabel(count: number): string {
  return `Questions & Answers (${count})`;
}

export function isSubmitDisabled(text: string, maxLength: number, isSubmitting: boolean): boolean {
  const trimmed = text.trim();
  return trimmed.length === 0 || trimmed.length > maxLength || isSubmitting;
}
