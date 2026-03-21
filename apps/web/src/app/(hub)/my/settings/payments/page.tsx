import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { listPaymentMethods } from '@/lib/actions/payment-methods';
import { PaymentMethodsClient } from '@/components/pages/payments/payment-methods-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Payments | Twicely',
  robots: 'noindex',
};

export default async function PaymentsSettingsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/settings/payments');
  }

  const { paymentMethods, defaultPaymentMethodId } = await listPaymentMethods();

  return (
    <PaymentMethodsClient
      initialPaymentMethods={paymentMethods}
      defaultPaymentMethodId={defaultPaymentMethodId ?? null}
    />
  );
}
