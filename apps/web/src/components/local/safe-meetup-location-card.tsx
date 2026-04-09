import { Shield, Star, MapPin } from 'lucide-react';
import { Badge } from '@twicely/ui/badge';
import type { SafeMeetupLocationRow } from '@/lib/queries/safe-meetup-locations';

interface SafeMeetupLocationCardProps {
  location: SafeMeetupLocationRow;
}

export function SafeMeetupLocationCard({ location }: SafeMeetupLocationCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-green-600 shrink-0" />
        <span className="font-medium text-sm">Safe Meetup Location</span>
        {location.verifiedSafe && (
          <Badge variant="outline" className="text-xs text-green-700 border-green-300">
            Verified safe spot
          </Badge>
        )}
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-medium text-gray-900">{location.name}</p>
        <p className="text-gray-600 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {location.address}, {location.city}, {location.state} {location.zip}
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        {location.rating !== null && (
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />
            <span className="font-medium text-gray-900">
              {location.rating.toFixed(1)}
            </span>
            <span className="text-xs">/ 5.0</span>
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {location.meetupCount} meetup{location.meetupCount !== 1 ? 's' : ''} here
        </span>
      </div>
    </div>
  );
}
