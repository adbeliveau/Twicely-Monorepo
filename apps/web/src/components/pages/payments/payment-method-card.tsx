'use client';

import { Button } from '@twicely/ui/button';
import { Card, CardContent } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { Loader2 } from 'lucide-react';
import type { SerializedPaymentMethod } from '@/lib/actions/payment-methods';

interface PaymentMethodCardProps {
  paymentMethod: SerializedPaymentMethod;
  onRemove: (id: string) => void;
  onSetDefault: (id: string) => void;
  isRemoving: boolean;
  isSettingDefault: boolean;
}

function formatBrand(brand: string): string {
  const map: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };
  return map[brand.toLowerCase()] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function PaymentMethodCard({
  paymentMethod,
  onRemove,
  onSetDefault,
  isRemoving,
  isSettingDefault,
}: PaymentMethodCardProps) {
  const { id, brand, last4, expMonth, expYear, isDefault } = paymentMethod;
  const busy = isRemoving || isSettingDefault;

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{formatBrand(brand)}</span>
            <span className="text-sm text-muted-foreground">&bull;&bull;&bull;&bull; {last4}</span>
            {isDefault && (
              <Badge variant="secondary" className="text-xs">Default</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Expires {String(expMonth).padStart(2, '0')}/{String(expYear).slice(-2)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isDefault && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetDefault(id)}
              disabled={busy}
            >
              {isSettingDefault ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Set as default'
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(id)}
            disabled={busy}
            className="text-destructive hover:text-destructive"
          >
            {isRemoving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Remove'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
