'use client';

import { MapPin, Shield, Clock } from 'lucide-react';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { Card, CardContent } from '@twicely/ui/card';
import { cn } from '@twicely/utils/cn';
import type { SafeMeetupLocationRow } from '@/lib/queries/safe-meetup-locations';

const TYPE_LABELS: Record<string, string> = {
  POLICE: 'Police Station',
  RETAIL: 'Retail Store',
  COMMUNITY: 'Community Center',
  CUSTOM: 'Verified Location',
};

interface MeetupLocationPickerProps {
  locations: SafeMeetupLocationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Displays a list of safe meetup locations for selection during meetup scheduling.
 * Each card shows: name, address, type badge, safe spot badge.
 */
export function MeetupLocationPicker({
  locations,
  selectedId,
  onSelect,
}: MeetupLocationPickerProps) {
  if (locations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No safe meetup locations found in your area.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Choose a Safe Meetup Spot
      </p>
      {locations.map((loc) => {
        const isSelected = selectedId === loc.id;

        return (
          <Card
            key={loc.id}
            className={cn(
              'cursor-pointer transition-colors',
              isSelected
                ? 'border-primary ring-1 ring-primary'
                : 'hover:border-muted-foreground/30'
            )}
            onClick={() => onSelect(loc.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="text-sm font-medium truncate">{loc.name}</span>
                      {loc.verifiedSafe && (
                        <Badge
                          variant="outline"
                          className="text-xs text-green-700 border-green-300 shrink-0"
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          Safe meetup spot
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {loc.address}, {loc.city}, {loc.state}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Badge variant="secondary" className="text-xs">
                        {TYPE_LABELS[loc.type] ?? loc.type}
                      </Badge>
                      {loc.rating !== null && loc.rating !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          ★ {loc.rating.toFixed(1)}
                        </span>
                      )}
                      {loc.meetupCount > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {loc.meetupCount} meetup{loc.meetupCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(loc.id);
                  }}
                  className="shrink-0"
                >
                  {isSelected ? 'Selected' : 'Select'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
