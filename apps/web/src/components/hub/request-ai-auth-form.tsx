'use client';

import { useTransition, useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Loader2, Upload, CheckCircle } from 'lucide-react';
import { requestAiAuthentication } from '@/lib/actions/authentication-ai';

export function RequestAiAuthForm() {
  const [isPending, startTransition] = useTransition();
  const [listingId, setListingId] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  function addPhotoUrl() {
    const url = photoInput.trim();
    if (!url) return;
    try {
      new URL(url);
      setPhotoUrls((prev) => [...prev, url]);
      setPhotoInput('');
    } catch {
      setResult({ success: false, message: 'Please enter a valid URL' });
    }
  }

  function removePhotoUrl(index: number) {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (!listingId.trim()) {
      setResult({ success: false, message: 'Please enter a listing ID' });
      return;
    }
    if (photoUrls.length < 3) {
      setResult({ success: false, message: 'Please add at least 3 photo URLs' });
      return;
    }

    startTransition(async () => {
      setResult(null);
      const res = await requestAiAuthentication({
        listingId: listingId.trim(),
        photoUrls,
      });
      if (res.success) {
        setResult({
          success: true,
          message: `Authentication request submitted! Certificate #${res.certificateNumber}`,
        });
        setListingId('');
        setPhotoUrls([]);
      } else {
        setResult({ success: false, message: res.error ?? 'Submission failed' });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="listingId">Listing ID</Label>
        <Input
          id="listingId"
          placeholder="Enter listing ID to authenticate"
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label>Photo URLs (minimum 3)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/photo.jpg"
            value={photoInput}
            onChange={(e) => setPhotoInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPhotoUrl(); } }}
            disabled={isPending}
          />
          <Button type="button" variant="outline" onClick={addPhotoUrl} disabled={isPending}>
            <Upload className="h-4 w-4" />
          </Button>
        </div>
        {photoUrls.length > 0 && (
          <ul className="mt-2 space-y-1">
            {photoUrls.map((url, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate max-w-[300px]">{url}</span>
                <button
                  type="button"
                  onClick={() => removePhotoUrl(i)}
                  className="text-red-500 hover:text-red-700"
                  disabled={isPending}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {photoUrls.length}/20 photos added ({Math.max(0, 3 - photoUrls.length)} more required)
        </p>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isPending || photoUrls.length < 3 || !listingId.trim()}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="mr-2 h-4 w-4" />
        )}
        Submit for AI Authentication
      </Button>

      {result && (
        <p className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
