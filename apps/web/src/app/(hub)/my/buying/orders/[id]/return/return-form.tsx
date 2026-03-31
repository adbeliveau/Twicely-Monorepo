'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@twicely/ui/radio-group';
import { AlertCircle, Upload, X, Loader2 } from 'lucide-react';

interface ReturnRequestFormProps {
  orderId: string;
  buyerId: string;
}

const RETURN_REASONS = [
  { value: 'INAD', label: 'Item not as described', description: 'Item differs from listing description or photos' },
  { value: 'DAMAGED', label: 'Item arrived damaged', description: 'Item was damaged during shipping' },
  { value: 'WRONG_ITEM', label: 'Wrong item received', description: 'I received a different item than what I ordered' },
  { value: 'COUNTERFEIT', label: 'Item is counterfeit', description: 'Item appears to be fake or not authentic' },
  { value: 'REMORSE', label: 'Changed my mind', description: 'I no longer want this item (restocking fee may apply)' },
] as const;

export function ReturnRequestForm({ orderId, buyerId }: ReturnRequestFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPhotos = ['INAD', 'DAMAGED', 'COUNTERFEIT'].includes(reason);
  const isRemorse = reason === 'REMORSE';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!reason) {
      setError('Please select a reason for your return');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a description');
      return;
    }

    if (needsPhotos && photos.length === 0) {
      setError('Photo evidence is required for this return reason');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/returns/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          buyerId,
          reason,
          description: description.trim(),
          photos,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit return request');
      }

      router.push(`/my/returns/${data.returnId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }

  async function handlePhotoUpload(files: FileList) {
    setIsUploading(true);
    setError(null);
    const remaining = 5 - photos.length;
    const filesToUpload = Array.from(files).slice(0, remaining);

    for (const file of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'listing');
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const json = await res.json() as { success: boolean; image?: { url?: string }; error?: string };
        if (json.success && json.image?.url) {
          setPhotos((prev) => [...prev, json.image!.url!]);
        } else {
          setError(json.error ?? 'Failed to upload photo');
        }
      } catch {
        setError('Failed to upload photo');
      }
    }
    setIsUploading(false);
  }

  function removePhoto(index: number) {
    setPhotos(photos.filter((_, i) => i !== index));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Reason selection */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Why are you returning this item?</Label>
        <RadioGroup value={reason} onValueChange={setReason}>
          {RETURN_REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                reason === r.value ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'
              }`}
            >
              <RadioGroupItem value={r.value} className="mt-0.5" />
              <div>
                <span className="font-medium">{r.label}</span>
                <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Restocking fee warning */}
      {isRemorse && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> A restocking fee may be deducted from your refund for changed mind returns.
            The fee amount is determined by our current return policy.
          </p>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-base font-medium">
          Describe the issue
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Please provide details about why you're returning this item..."
          rows={4}
          required
        />
      </div>

      {/* Photo upload */}
      {(needsPhotos || photos.length > 0) && (
        <div className="space-y-2">
          <Label className="text-base font-medium">
            Photo evidence {needsPhotos && <span className="text-red-500">*</span>}
          </Label>
          <p className="text-sm text-gray-500">
            Upload photos showing the issue with your item
          </p>

          <div className="flex flex-wrap gap-3">
            {photos.map((photo, index) => (
              <div
                key={index}
                className="relative h-20 w-20 rounded-lg bg-gray-100 border overflow-hidden"
              >
                <img src={photo} alt={`Evidence ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {photos.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-20 w-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
                <span className="text-xs">{isUploading ? 'Uploading' : 'Upload'}</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handlePhotoUpload(e.target.files);
              }
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !reason}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Return Request'
          )}
        </Button>
      </div>
    </form>
  );
}
