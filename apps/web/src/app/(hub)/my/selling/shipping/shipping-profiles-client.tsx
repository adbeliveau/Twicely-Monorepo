'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Plus } from 'lucide-react';
import { ShippingProfileCard } from '@/components/seller/shipping-profile-card';
import { ShippingProfileForm } from '@/components/seller/shipping-profile-form';
import type { ShippingProfileData } from '@/lib/queries/shipping-profiles';

interface ShippingProfilesClientProps {
  profiles: (ShippingProfileData & { listingCount: number })[];
  profileLimit: number;
  currentCount: number;
}

export function ShippingProfilesClient({
  profiles,
  profileLimit,
  currentCount,
}: ShippingProfilesClientProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ShippingProfileData | null>(null);

  const handleEdit = (profile: ShippingProfileData) => {
    setEditingProfile(profile);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingProfile(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingProfile(null);
  };

  const isAtLimit = currentCount >= profileLimit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shipping Profiles</h1>
          <p className="text-muted-foreground">
            Manage your shipping settings and apply them to multiple listings.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {currentCount} of {profileLimit} profiles used
            {profileLimit === 3 && ' (upgrade your store for more)'}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={isAtLimit}>
          <Plus className="mr-2 h-4 w-4" />
          {isAtLimit ? 'Limit Reached' : 'Create Profile'}
        </Button>
      </div>

      {/* Profiles Grid */}
      {profiles.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">
            You don&apos;t have any shipping profiles yet.
          </p>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Profile
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <ShippingProfileCard
              key={profile.id}
              profile={profile}
              listingCount={profile.listingCount}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <ShippingProfileForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        profile={editingProfile}
      />
    </div>
  );
}
