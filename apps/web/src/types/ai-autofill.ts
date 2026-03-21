export interface AiAutofillSuggestions {
  title: string;
  description: string;
  category: string;
  brand: string;
  condition: string | null;
  color: string;
  tags: string[];
  suggestedPriceMinCents: number;
  suggestedPriceMaxCents: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AiAutofillResponse {
  success: true;
  suggestions: AiAutofillSuggestions;
  remainingUses: number;
}

export interface AiAutofillErrorResponse {
  success: false;
  error: string;
  remainingUses?: number;
}
