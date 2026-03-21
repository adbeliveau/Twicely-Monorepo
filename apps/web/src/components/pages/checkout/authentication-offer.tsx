'use client';

import { ShieldCheck } from 'lucide-react';
import { formatPrice } from '@twicely/utils/format';

interface AuthenticationOfferProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  authBuyerFeeCents: number;
}

/**
 * B3.5: Authentication offer for high-value items ($500+).
 * Displayed in checkout when cart contains eligible items.
 * Fee is loaded from platform_settings server-side and passed as a prop.
 */
export function AuthenticationOffer({ checked, onChange, disabled, authBuyerFeeCents }: AuthenticationOfferProps) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-blue-100 p-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Professional Authentication</h3>
          <p className="text-sm text-gray-600 mt-1">
            Your cart contains high-value items eligible for professional authentication.
            Add authentication for {formatPrice(authBuyerFeeCents)} and receive a certificate of authenticity.
          </p>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium">
              Add authentication (+{formatPrice(authBuyerFeeCents)})
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
