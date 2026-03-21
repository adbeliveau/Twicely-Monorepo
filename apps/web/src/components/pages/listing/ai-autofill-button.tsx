'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import type { AiAutofillSuggestions } from '@/types/ai-autofill';

function isAiAutofillSuggestions(value: unknown): value is AiAutofillSuggestions {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['title'] === 'string' &&
    typeof v['description'] === 'string' &&
    typeof v['category'] === 'string' &&
    typeof v['brand'] === 'string' &&
    (v['condition'] === null || typeof v['condition'] === 'string') &&
    typeof v['color'] === 'string' &&
    Array.isArray(v['tags']) &&
    typeof v['suggestedPriceMinCents'] === 'number' &&
    typeof v['suggestedPriceMaxCents'] === 'number' &&
    (v['confidence'] === 'HIGH' || v['confidence'] === 'MEDIUM' || v['confidence'] === 'LOW')
  );
}

interface AiAutofillButtonProps {
  imageUrls: string[];
  onSuggestionsReceived: (suggestions: AiAutofillSuggestions) => void;
  disabled?: boolean;
  remainingUses?: number;
}

export function AiAutofillButton({
  imageUrls,
  onSuggestionsReceived,
  disabled,
  remainingUses,
}: AiAutofillButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasImages = imageUrls.length >= 1;
  const isDisabled = disabled ?? false;

  async function handleClick() {
    if (!hasImages || isLoading || isDisabled) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/listings/ai-autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls }),
      });

      const data: unknown = await response.json();

      if (
        data !== null &&
        typeof data === 'object' &&
        'success' in data &&
        data.success === true &&
        'suggestions' in data &&
        isAiAutofillSuggestions(data.suggestions)
      ) {
        onSuggestionsReceived(data.suggestions);
      } else {
        const errorText =
          data !== null &&
          typeof data === 'object' &&
          'error' in data &&
          typeof data.error === 'string'
            ? data.error
            : 'Auto-fill unavailable, please fill in manually';
        setErrorMessage(errorText);
      }
    } catch {
      setErrorMessage('Auto-fill unavailable, please fill in manually');
    } finally {
      setIsLoading(false);
    }
  }

  if (!hasImages) return null;

  const showUnlimited = remainingUses === -1;
  const showCount = remainingUses !== undefined && remainingUses !== -1;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={isDisabled || isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isLoading ? 'Analyzing photos...' : 'Auto-fill with AI'}
        </Button>

        {showUnlimited && (
          <span className="text-xs text-muted-foreground">Unlimited uses</span>
        )}
        {showCount && remainingUses !== undefined && (
          <span className="text-xs text-muted-foreground">
            {remainingUses} use{remainingUses !== 1 ? 's' : ''} remaining this month
          </span>
        )}
      </div>

      {errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
