'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@twicely/ui/radio-group';
import { AlertCircle, Upload, X, Loader2, Shield } from 'lucide-react';
import { createCounterfeitClaimAction } from '@/lib/actions/counterfeit-claim';

interface ProtectionClaimFormProps {
  orderId: string;
  buyerId: string;
}

const CLAIM_REASONS = [
  {
    value: 'INR',
    label: 'Item not received',
    description: 'The item never arrived',
    needsPhotos: false,
  },
  {
    value: 'INAD',
    label: 'Item not as described',
    description: 'Item differs significantly from the listing',
    needsPhotos: true,
  },
  {
    value: 'DAMAGED',
    label: 'Item arrived damaged',
    description: 'Item was damaged during shipping',
    needsPhotos: true,
  },
  {
    value: 'WRONG_ITEM',
    label: 'Wrong item received',
    description: 'I received a different item than ordered',
    needsPhotos: true,
  },
  {
    value: 'COUNTERFEIT',
    label: 'Item is counterfeit',
    description: 'Item appears to be fake or not authentic (60-day window)',
    needsPhotos: true,
  },
] as const;

export function ProtectionClaimForm({ orderId, buyerId }: ProtectionClaimFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedReason = CLAIM_REASONS.find((r) => r.value === reason);
  const needsPhotos = selectedReason?.needsPhotos ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!reason) {
      setError('Please select a reason for your claim');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a description of the issue');
      return;
    }

    if (needsPhotos && photos.length === 0) {
      setError('Photo evidence is required for this claim type');
      return;
    }

    setIsSubmitting(true);
    try {
      let claimId: string | undefined;
      if (reason === 'COUNTERFEIT') {
        // C5.2: Dedicated server action for counterfeit claims
        const result = await createCounterfeitClaimAction({ orderId, description: description.trim(), photos });
        if (!result.success) throw new Error(result.error || 'Failed to submit claim');
        claimId = result.claimId;
      } else {
        const response = await fetch('/api/protection/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, buyerId, reason, description: description.trim(), photos }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to submit claim');
        claimId = data.claimId;
      }
      router.push(`/my/disputes/${claimId}`);
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
        <Label className="text-base font-medium">What happened with your order?</Label>
        <RadioGroup value={reason} onValueChange={setReason}>
          {CLAIM_REASONS.map((r) => (
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

      {/* Counterfeit notice */}
      {reason === 'COUNTERFEIT' && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-purple-800">Extended Protection</h4>
              <p className="text-sm text-purple-700 mt-1">
                Counterfeit claims have a 60-day window from delivery. Our team takes these claims
                very seriously and will investigate thoroughly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-base font-medium">
          Describe the issue in detail
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Please provide as much detail as possible about the issue..."
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
            Upload clear photos showing the issue. This helps us resolve your claim faster.
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
            <>
              <Shield className="mr-2 h-4 w-4" />
              Submit Protection Claim
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
