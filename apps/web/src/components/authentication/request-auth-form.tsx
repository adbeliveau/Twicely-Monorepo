'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@twicely/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { requestItemAuthentication } from '@/lib/actions/authentication';

type Listing = {
  id: string;
  title: string;
};

type RequestAuthFormProps = {
  listings: Listing[];
  expertFeeCents: number;
};

export function RequestAuthForm({ listings, expertFeeCents }: RequestAuthFormProps) {
  const [selectedListingId, setSelectedListingId] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [photoInput, setPhotoInput] = useState('');

  const feeDisplay = `$${(expertFeeCents / 100).toFixed(2)}`;

  function addPhotoUrl() {
    const url = photoInput.trim();
    if (!url || photoUrls.length >= 20) return;
    setPhotoUrls((prev) => [...prev, url]);
    setPhotoInput('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedListingId) {
      setError('Please select a listing.');
      return;
    }
    if (photoUrls.length < 3) {
      setError('At least 3 authentication photos are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestItemAuthentication({
        listingId: selectedListingId,
        tier: 'EXPERT',
        photoUrls,
      });
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error ?? 'An error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
            <p className="font-medium">Authentication request submitted successfully.</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            You will be notified when the result is available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          Request Expert Authentication
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listing-select">Select listing</Label>
            <Select value={selectedListingId} onValueChange={setSelectedListingId}>
              <SelectTrigger id="listing-select">
                <SelectValue placeholder="Choose a listing..." />
              </SelectTrigger>
              <SelectContent>
                {listings.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Authentication tier</Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="border-indigo-300 text-indigo-700 bg-indigo-50">
                Expert ({feeDisplay})
              </Button>
              <Button type="button" variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed">
                AI (Coming Soon)
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Authentication photos ({photoUrls.length}/20, min 3)</Label>
            <div className="flex gap-2">
              <input
                type="url"
                value={photoInput}
                onChange={(e) => setPhotoInput(e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={addPhotoUrl}>
                Add
              </Button>
            </div>
            {photoUrls.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {photoUrls.map((url, i) => <li key={i} className="truncate">{url}</li>)}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting...' : `Request Expert Authentication (${feeDisplay})`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
