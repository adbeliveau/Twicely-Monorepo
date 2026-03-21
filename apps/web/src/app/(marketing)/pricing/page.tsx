import { Metadata } from 'next';
import { PricingToggle } from './pricing-toggle';

export const metadata: Metadata = {
  title: 'Pricing — Twicely',
  description: 'Simple, transparent fees. Start at 10%, drop to 8% as you grow. No hidden costs.',
};

export default function PricingPage() {
  return (
    <div className="container py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your first $500 every month? Just 10%. The more you sell, the lower it goes — all the way down to 8%.
          </p>
        </div>

        {/* Interactive pricing sections */}
        <PricingToggle />

        {/* Footer */}
        <div className="mt-16 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            All paid plans come with a 14-day free trial. Cancel anytime.
          </p>
          <p className="text-xs text-muted-foreground">
            Funds are processed and paid out through Stripe. Twicely displays payout status and transaction activity.
          </p>
        </div>
      </div>
    </div>
  );
}
