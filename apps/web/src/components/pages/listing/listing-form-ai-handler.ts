import type { ListingFormData, ListingCondition } from '@/types/listing-form';
import type { AiAutofillSuggestions } from '@/types/ai-autofill';

export function applyAiSuggestions(
  formData: ListingFormData,
  s: AiAutofillSuggestions,
  updateField: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void,
  setAiPriceHint: (hint: string | null) => void,
): void {
  if (!formData.title && s.title) updateField('title', s.title);
  if (!formData.description && s.description) updateField('description', s.description);
  if (!formData.brand && s.brand) updateField('brand', s.brand);
  if (!formData.condition && s.condition) updateField('condition', s.condition as ListingCondition);
  if (!formData.tags.length && s.tags.length) updateField('tags', s.tags);
  if (s.suggestedPriceMinCents > 0 && s.suggestedPriceMaxCents > 0) {
    setAiPriceHint(
      `AI suggests $${(s.suggestedPriceMinCents / 100).toFixed(2)} – $${(s.suggestedPriceMaxCents / 100).toFixed(2)}`
    );
  }
}
