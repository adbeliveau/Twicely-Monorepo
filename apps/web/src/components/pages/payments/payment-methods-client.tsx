'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Loader2, CreditCard } from 'lucide-react';
import { PaymentMethodCard } from './payment-method-card';
import { AddCardForm } from './add-card-form';
import { removePaymentMethod, setDefaultPaymentMethod } from '@/lib/actions/payment-methods';
import type { SerializedPaymentMethod } from '@/lib/actions/payment-methods';

interface PaymentMethodsClientProps {
  initialPaymentMethods: SerializedPaymentMethod[];
  defaultPaymentMethodId: string | null;
}

export function PaymentMethodsClient({
  initialPaymentMethods,
  defaultPaymentMethodId: _defaultPaymentMethodId,
}: PaymentMethodsClientProps) {
  const [paymentMethods, setPaymentMethods] = useState<SerializedPaymentMethod[]>(
    initialPaymentMethods,
  );
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [addCardClientSecret, setAddCardClientSecret] = useState<string | null>(null);
  const [loadingAddCard, setLoadingAddCard] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddCardClick = async () => {
    setLoadingAddCard(true);
    setError(null);

    try {
      const res = await fetch('/api/payments/setup-intent', { method: 'POST' });
      const data = (await res.json()) as { success: boolean; clientSecret?: string; error?: string };

      if (!data.success || !data.clientSecret) {
        setError(data.error ?? 'Failed to start card setup. Please try again.');
        return;
      }

      setAddCardClientSecret(data.clientSecret);
      setIsAddingCard(true);
    } catch {
      setError('Failed to start card setup. Please try again.');
    } finally {
      setLoadingAddCard(false);
    }
  };

  const handleCardAdded = (newPm: SerializedPaymentMethod) => {
    setPaymentMethods((prev) => {
      const exists = prev.some((pm) => pm.id === newPm.id);
      return exists ? prev : [...prev, newPm];
    });
    setIsAddingCard(false);
    setAddCardClientSecret(null);
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    setError(null);

    const result = await removePaymentMethod(id);

    if (result.success) {
      setPaymentMethods((prev) => prev.filter((pm) => pm.id !== id));
    } else {
      setError(result.error ?? 'Failed to remove card');
    }

    setRemovingId(null);
  };

  const handleSetDefault = async (id: string) => {
    setSettingDefaultId(id);
    setError(null);

    const result = await setDefaultPaymentMethod(id);

    if (result.success) {
      setPaymentMethods((prev) =>
        prev.map((pm) => ({ ...pm, isDefault: pm.id === id })),
      );
    } else {
      setError(result.error ?? 'Failed to set default card');
    }

    setSettingDefaultId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Saved Payment Methods</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the cards used for purchases on Twicely.
        </p>
      </div>

      <p className="text-xs text-muted-foreground border rounded-md p-3 bg-muted/40">
        Payments are processed and paid out through Stripe. Twicely displays payment status and
        transaction activity.
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {paymentMethods.length === 0 && !isAddingCard ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No saved payment methods. Add a card to speed up checkout.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((pm) => (
            <PaymentMethodCard
              key={pm.id}
              paymentMethod={pm}
              onRemove={handleRemove}
              onSetDefault={handleSetDefault}
              isRemoving={removingId === pm.id}
              isSettingDefault={settingDefaultId === pm.id}
            />
          ))}
        </div>
      )}

      {isAddingCard && addCardClientSecret ? (
        <AddCardForm
          clientSecret={addCardClientSecret}
          onSuccess={handleCardAdded}
          onCancel={() => {
            setIsAddingCard(false);
            setAddCardClientSecret(null);
          }}
        />
      ) : (
        <Button
          variant="outline"
          onClick={handleAddCardClick}
          disabled={loadingAddCard}
        >
          {loadingAddCard ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Add a card
        </Button>
      )}
    </div>
  );
}
