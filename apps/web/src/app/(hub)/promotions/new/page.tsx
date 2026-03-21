import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { CreatePromoCodeForm } from './create-promo-code-form';

export const metadata: Metadata = { title: 'Create Promo Code | Twicely Hub' };

export default async function CreatePromoCodePage() {
  const { ability } = await staffAuthorize();

  if (!ability.can('manage', 'PromoCode')) {
    return <p className="text-red-600">Access denied</p>;
  }

  return <CreatePromoCodeForm />;
}
