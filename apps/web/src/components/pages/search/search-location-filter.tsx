'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { MapPin, Loader2, X } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import { resolveSearchLocation } from '@/lib/actions/geocode';

const RADIUS_OPTIONS = [
  { value: '5', label: '5 miles' },
  { value: '10', label: '10 miles' },
  { value: '25', label: '25 miles' },
  { value: '50', label: '50 miles' },
  { value: '100', label: '100 miles' },
];

interface SearchLocationFilterProps {
  /** Pre-resolved location label from server (if geo params present on load). */
  locationLabel?: string | null;
}

export function SearchLocationFilter({ locationLabel }: SearchLocationFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentNear = searchParams.get('near');
  const currentLat = searchParams.get('lat');
  const currentRadius = searchParams.get('r') ?? '25';
  const hasLocation = !!(currentNear || currentLat);

  const [zip, setZip] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSetLocation() {
    if (!zip.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await resolveSearchLocation({ zip: zip.trim() });
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }

      const params = new URLSearchParams(searchParams.toString());
      params.set('lat', String(result.lat));
      params.set('lng', String(result.lng));
      params.set('near', zip.trim());
      if (!params.has('r')) params.set('r', '25');
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
      setZip('');
    });
  }

  function handleRadiusChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('r', value);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleClearLocation() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('near');
    params.delete('lat');
    params.delete('lng');
    params.delete('r');
    // Reset sort if it was "nearest"
    if (params.get('sort') === 'nearest') params.delete('sort');
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Location</h3>

      {hasLocation ? (
        <div className="space-y-3">
          {/* Current location display */}
          <div className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-sm">
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
              <span className="font-medium">
                {locationLabel ?? currentNear ?? 'Your location'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearLocation}
              className="rounded-full p-0.5 hover:bg-background"
              aria-label="Remove location filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Radius selector */}
          <div>
            <Label htmlFor="radius" className="text-sm text-muted-foreground">
              Search radius
            </Label>
            <Select value={currentRadius} onValueChange={handleRadiusChange}>
              <SelectTrigger id="radius" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RADIUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="location-zip" className="sr-only">
            Zip code or city
          </Label>
          <div className="flex gap-2">
            <Input
              id="location-zip"
              type="text"
              placeholder="Zip code or city"
              value={zip}
              onChange={(e) => {
                setZip(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSetLocation();
              }}
              disabled={isPending}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleSetLocation}
              disabled={isPending || !zip.trim()}
              aria-label="Set location"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </Button>
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
