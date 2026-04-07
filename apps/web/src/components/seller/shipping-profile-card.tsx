'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import { Badge } from '@twicely/ui/badge';
import { Pencil, Trash2, Star } from 'lucide-react';
import { deleteShippingProfile, setDefaultShippingProfile } from '@/lib/actions/shipping-profile-manage';
import { useRouter } from 'next/navigation';
import type { ShippingProfileData } from '@/lib/queries/shipping-profiles';

interface ShippingProfileCardProps {
  profile: ShippingProfileData;
  listingCount?: number;
  onEdit: (profile: ShippingProfileData) => void;
}

export function ShippingProfileCard({ profile, listingCount = 0, onEdit }: ShippingProfileCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this shipping profile?')) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    const result = await deleteShippingProfile(profile.id);
    setIsDeleting(false);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || 'Failed to delete profile');
    }
  };

  const handleSetDefault = async () => {
    setIsSettingDefault(true);
    setError(null);
    const result = await setDefaultShippingProfile(profile.id);
    setIsSettingDefault(false);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || 'Failed to set default profile');
    }
  };

  const combinedShippingLabel = getCombinedShippingLabel(profile);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{profile.name}</CardTitle>
              {profile.isDefault && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  Default
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              {profile.carrier}
              {profile.service && ` - ${profile.service}`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(profile)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting || profile.isDefault}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-3 text-sm text-destructive">{error}</p>
        )}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Handling Time:</span>
            <span className="font-medium">{profile.handlingTimeDays} {profile.handlingTimeDays === 1 ? 'day' : 'days'}</span>
          </div>
          {profile.weightOz && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weight:</span>
              <span className="font-medium">{profile.weightOz} oz</span>
            </div>
          )}
          {(profile.lengthIn || profile.widthIn || profile.heightIn) && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dimensions:</span>
              <span className="font-medium">
                {profile.lengthIn || 0} × {profile.widthIn || 0} × {profile.heightIn || 0} in
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Combined Shipping:</span>
            <span className="font-medium">{combinedShippingLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Used in Listings:</span>
            <span className="font-medium">{listingCount}</span>
          </div>
        </div>
        {!profile.isDefault && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSetDefault}
              disabled={isSettingDefault}
            >
              Set as Default
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getCombinedShippingLabel(profile: ShippingProfileData): string {
  switch (profile.combinedShippingMode) {
    case 'NONE':
      return 'None';
    case 'FLAT':
      return `Flat $${((profile.flatCombinedCents || 0) / 100).toFixed(2)}`;
    case 'PER_ADDITIONAL':
      return `+$${((profile.additionalItemCents || 0) / 100).toFixed(2)} per item`;
    case 'AUTO_DISCOUNT':
      return `${profile.autoDiscountPercent}% off (${profile.autoDiscountMinItems || 2}+ items)`;
    case 'QUOTED':
      return 'Quoted (manual)';
    default:
      return 'None';
  }
}
