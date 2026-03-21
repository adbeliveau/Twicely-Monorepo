'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@twicely/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@twicely/ui/alert-dialog';
import { AddressForm } from '@/components/shared/address-form';
import type { AddressFormData } from '@/lib/validations/address';
import {
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '@/lib/actions/addresses';
import type { AddressData } from '@/lib/queries/address';
import { Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react';

interface AddressManagementProps {
  initialAddresses: AddressData[];
}

export function AddressManagement({ initialAddresses }: AddressManagementProps) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  function handleAddNew() {
    setEditingAddress(null);
    setIsFormOpen(true);
  }

  function handleEdit(address: AddressData) {
    setEditingAddress(address);
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    setIsFormOpen(false);
    setEditingAddress(null);
  }

  async function handleSubmit(data: AddressFormData) {
    setIsSubmitting(true);

    let result;
    if (editingAddress) {
      result = await updateAddress(editingAddress.id, data);
    } else {
      result = await createAddress(data);
    }

    setIsSubmitting(false);

    if (result.success && result.addressId) {
      // Construct the address object from form data + returned ID
      const newAddressData: AddressData = {
        id: result.addressId,
        userId: editingAddress?.userId ?? '', // Will be set by server, use existing or empty
        label: data.label?.trim() || null,
        name: data.name.trim(),
        address1: data.address1.trim(),
        address2: data.address2?.trim() || null,
        city: data.city.trim(),
        state: data.state.trim(),
        zip: data.zip.trim(),
        country: data.country || 'US',
        phone: data.phone?.trim() || null,
        isDefault: data.isDefault ?? false,
        createdAt: editingAddress?.createdAt ?? new Date(),
      };

      if (editingAddress) {
        // Update existing address in list
        setAddresses((prev) =>
          prev.map((addr) =>
            addr.id === editingAddress.id ? newAddressData : addr
          )
        );
      } else {
        // Add new address to list
        setAddresses((prev) => [...prev, newAddressData]);
      }

      // If the new/updated address is default, unset others
      if (data.isDefault) {
        setAddresses((prev) =>
          prev.map((addr) => ({
            ...addr,
            isDefault: addr.id === result.addressId,
          }))
        );
      }

      handleCloseForm();
      return { success: true };
    }

    return { success: false, errors: result.errors };
  }

  async function handleDelete() {
    if (!deletingId) return;

    const result = await deleteAddress(deletingId);

    if (result.success) {
      setAddresses((prev) => prev.filter((addr) => addr.id !== deletingId));
    }

    setDeletingId(null);
  }

  async function handleSetDefault(addressId: string) {
    setSettingDefaultId(addressId);
    const result = await setDefaultAddress(addressId);

    if (result.success) {
      setAddresses((prev) =>
        prev.map((addr) => ({
          ...addr,
          isDefault: addr.id === addressId,
        }))
      );
    }
    setSettingDefaultId(null);
  }

  return (
    <div className="space-y-4">
      {/* Address List */}
      {addresses.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-muted-foreground mb-4">
            You haven&apos;t saved any shipping addresses yet.
          </p>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Address
          </Button>
        </div>
      ) : (
        <>
          {addresses.map((address) => (
            <div
              key={address.id}
              className="border rounded-lg p-4 bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Label and Default Badge */}
                  <div className="flex items-center gap-2 mb-1">
                    {address.label && (
                      <span className="font-medium">{address.label}</span>
                    )}
                    {address.isDefault && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <p className="font-medium">{address.name}</p>

                  {/* Address */}
                  <p className="text-sm text-muted-foreground mt-1">
                    {address.address1}
                    {address.address2 && `, ${address.address2}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {address.city}, {address.state} {address.zip}
                  </p>

                  {/* Phone */}
                  {address.phone && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {address.phone}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {!address.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(address.id)}
                      disabled={settingDefaultId === address.id}
                      title="Set as default"
                    >
                      {settingDefaultId === address.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(address)}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingId(address.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <Button onClick={handleAddNew} variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Address
          </Button>
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Edit Address' : 'Add New Address'}
            </DialogTitle>
          </DialogHeader>
          <AddressForm
            initialData={
              editingAddress
                ? {
                    label: editingAddress.label ?? '',
                    name: editingAddress.name,
                    address1: editingAddress.address1,
                    address2: editingAddress.address2 ?? '',
                    city: editingAddress.city,
                    state: editingAddress.state,
                    zip: editingAddress.zip,
                    country: editingAddress.country,
                    phone: editingAddress.phone ?? '',
                    isDefault: editingAddress.isDefault,
                  }
                : undefined
            }
            onSubmit={handleSubmit}
            onCancel={handleCloseForm}
            isSubmitting={isSubmitting}
            submitLabel={editingAddress ? 'Update Address' : 'Save Address'}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this shipping address. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
