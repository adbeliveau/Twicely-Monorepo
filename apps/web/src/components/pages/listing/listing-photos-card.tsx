'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { ImageUploader } from './image-uploader';
import { AiAutofillButton } from './ai-autofill-button';
import type { UploadedImage } from '@/types/upload';
import type { AiAutofillSuggestions } from '@/types/ai-autofill';

interface ListingPhotosCardProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  disabled?: boolean;
  imagesError?: string;
  aiAutofillRemaining?: number;
  onAiSuggestions: (suggestions: AiAutofillSuggestions) => void;
  aiSuggestionApplied: boolean;
}

export function ListingPhotosCard({
  images,
  onChange,
  disabled,
  imagesError,
  aiAutofillRemaining,
  onAiSuggestions,
  aiSuggestionApplied,
}: ListingPhotosCardProps) {
  const imageUrls = images.map((img) => img.url).filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photos</CardTitle>
      </CardHeader>
      <CardContent>
        <ImageUploader images={images} onChange={onChange} disabled={disabled} />
        {imagesError && <p className="mt-2 text-sm text-destructive">{imagesError}</p>}
        {aiAutofillRemaining !== undefined && (
          <div className="mt-3">
            <AiAutofillButton
              imageUrls={imageUrls}
              onSuggestionsReceived={onAiSuggestions}
              disabled={disabled}
              remainingUses={aiAutofillRemaining}
            />
          </div>
        )}
        {aiSuggestionApplied && (
          <p className="mt-2 text-xs text-muted-foreground">
            AI suggestions applied. Review and edit before publishing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
