'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { cn } from '@twicely/utils';
import Link from 'next/link';

// TODO: Read from platform_settings at runtime

// Store Tiers - Canonical §4.2
const STORE_TIERS = [
  { name: 'Free', annual: 0, monthly: 0, listings: 100, insertion: 35, features: ['Seller profile', 'Manual payouts ($15 min)'] },
  { name: 'Starter', annual: 699, monthly: 1200, listings: 250, insertion: 25, features: ['Announcement bar', 'Social links', 'Weekly auto-payout'] },
  { name: 'Pro', annual: 2999, monthly: 3999, listings: 2000, insertion: 10, features: ['Custom categories', 'Bulk tools', 'Analytics', 'Boosting', 'Coupons'], popular: true },
  { name: 'Power', annual: 5999, monthly: 7999, listings: 15000, insertion: 5, features: ['Puck page builder', 'Market intelligence', 'Daily auto-payout', '25 staff accounts'] },
  { name: 'Enterprise', annual: null, monthly: null, listings: 100000, insertion: 0, features: ['100K+ listings', 'API access', 'Dedicated rep', 'Free daily payouts'] },
];

// Crosslister Tiers - Canonical §6.2
const CROSSLISTER_TIERS = [
  { name: 'Free', annual: 0, monthly: 0, publishes: 25 },
  { name: 'Lite', annual: 999, monthly: 1399, publishes: 200 },
  { name: 'Pro', annual: 2999, monthly: 3999, publishes: 2000 },
];

// Bundles - Canonical §9
const BUNDLES = [
  { name: 'Seller Starter', annual: 1799, monthly: 2499, includes: 'Store Starter + Finance Pro', savings: '~$4/mo' },
  { name: 'Seller Pro', annual: 5999, monthly: 7499, includes: 'Store Pro + Crosslister Pro + Finance Pro', savings: '~$20/mo' },
  { name: 'Seller Power', annual: 8999, monthly: 10999, includes: 'Store Power + Crosslister Pro + Finance Pro + Automation', savings: '~$30/mo' },
];

// TF Brackets - Canonical §2.1
const TF_BRACKETS = [
  { range: '$0 – $499', rate: '10.0%', segment: 'New/casual' },
  { range: '$500 – $1,999', rate: '11.0%', segment: 'Hobbyist' },
  { range: '$2,000 – $4,999', rate: '10.5%', segment: 'Part-time' },
  { range: '$5,000 – $9,999', rate: '10.0%', segment: 'Full-time' },
  { range: '$10,000 – $24,999', rate: '9.5%', segment: 'Established' },
  { range: '$25,000 – $49,999', rate: '9.0%', segment: 'Power seller' },
  { range: '$50,000 – $99,999', rate: '8.5%', segment: 'Top seller' },
  { range: '$100,000+', rate: '8.0%', segment: 'Enterprise' },
];

function formatPrice(cents: number | null): string {
  if (cents === null) return 'Custom';
  if (cents === 0) return '$0';
  return `$${(cents / 100).toFixed(2)}`;
}

export function PricingToggle() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <div className="space-y-16">
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <span className={cn('text-sm', !isAnnual && 'font-semibold')}>Monthly</span>
        <button
          onClick={() => setIsAnnual(!isAnnual)}
          className={cn(
            'relative w-14 h-7 rounded-full transition-colors',
            isAnnual ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
              isAnnual ? 'translate-x-8' : 'translate-x-1'
            )}
          />
        </button>
        <span className={cn('text-sm', isAnnual && 'font-semibold')}>
          Annual <Badge variant="secondary" className="ml-1">Save 20%+</Badge>
        </span>
      </div>

      {/* Store Tiers */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-2">Store Subscriptions</h2>
        <p className="text-center text-muted-foreground mb-8">Unlock storefront features and lower insertion fees</p>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {STORE_TIERS.map((tier) => (
            <Card key={tier.name} className={cn('relative', tier.popular && 'border-primary border-2')}>
              {tier.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">Popular</Badge>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <div className="text-2xl font-bold">
                  {formatPrice(isAnnual ? tier.annual : tier.monthly)}
                  {tier.annual !== null && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div className="space-y-1 pb-3 border-b">
                  <p><strong>{tier.listings.toLocaleString()}</strong> free listings/mo</p>
                  <p>Insertion fee: <strong>${(tier.insertion / 100).toFixed(2)}</strong></p>
                </div>
                <ul className="space-y-1.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-4" variant={tier.name === 'Enterprise' ? 'outline' : 'default'} asChild>
                  <Link href={tier.name === 'Enterprise' ? '/contact-sales' : '/auth/signup'}>
                    {tier.name === 'Enterprise' ? 'Contact Sales' : 'Get Started Free'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Transaction Fee */}
      <section className="bg-muted/50 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-center mb-2">Transaction Fee</h2>
        <p className="text-center text-muted-foreground mb-2 max-w-2xl mx-auto">
          Your first $500/mo: 10%. The more you sell, the lower it goes — down to 8%.
        </p>
        <p className="text-center text-sm text-muted-foreground mb-6">
          Payment processing (Stripe ~2.9% + $0.30) shown separately.
        </p>
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Monthly Sales</th>
                <th className="text-center py-2 px-3">TF Rate</th>
                <th className="text-left py-2 px-3 hidden sm:table-cell">Segment</th>
              </tr>
            </thead>
            <tbody>
              {TF_BRACKETS.map((b) => (
                <tr key={b.range} className="border-b border-muted">
                  <td className="py-2 px-3">{b.range}</td>
                  <td className="py-2 px-3 text-center font-semibold">{b.rate}</td>
                  <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{b.segment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-4">
          Marginal rates (like income tax brackets). Minimum TF: $0.50/order.
        </p>
      </section>

      {/* Crosslister */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-2">Crosslister — Crosslisting Tool</h2>
        <p className="text-center text-muted-foreground mb-8">Publish to eBay, Poshmark, Mercari & more</p>
        <div className="grid gap-4 md:grid-cols-3 max-w-3xl mx-auto">
          {CROSSLISTER_TIERS.map((tier) => (
            <Card key={tier.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <div className="text-2xl font-bold">
                  {formatPrice(isAnnual ? tier.annual : tier.monthly)}
                  {tier.annual !== null && tier.annual > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm"><strong>{tier.publishes}</strong> publishes/mo</p>
                <p className="text-xs text-muted-foreground mt-1">Imports always free</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Bundles */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-2">Bundles — Save More</h2>
        <p className="text-center text-muted-foreground mb-8">Combine subscriptions for maximum value</p>
        <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
          {BUNDLES.map((b) => (
            <Card key={b.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{b.name}</CardTitle>
                <div className="text-2xl font-bold">
                  {formatPrice(isAnnual ? b.annual : b.monthly)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>
                <Badge variant="secondary" className="w-fit">Save {b.savings}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{b.includes}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Competitor Comparison */}
      <section className="bg-muted/50 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-center mb-6">How We Compare</h2>
        <div className="max-w-3xl mx-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3"></th>
                <th className="py-2 px-3 text-center font-bold text-primary">Twicely</th>
                <th className="py-2 px-3 text-center">eBay</th>
                <th className="py-2 px-3 text-center">Poshmark</th>
                <th className="py-2 px-3 text-center">Mercari</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-muted">
                <td className="py-2 px-3 font-medium">Seller fee</td>
                <td className="py-2 px-3 text-center font-semibold text-green-600">8-11% TF</td>
                <td className="py-2 px-3 text-center">12.9%+</td>
                <td className="py-2 px-3 text-center">20%</td>
                <td className="py-2 px-3 text-center">10% + $0.50</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-2 px-3 font-medium">Monthly sub</td>
                <td className="py-2 px-3 text-center font-semibold text-green-600">From $0</td>
                <td className="py-2 px-3 text-center">$0–$21.95</td>
                <td className="py-2 px-3 text-center">$0</td>
                <td className="py-2 px-3 text-center">$0</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-2 px-3 font-medium">Crosslisting</td>
                <td className="py-2 px-3 text-center font-semibold text-green-600">Built-in</td>
                <td className="py-2 px-3 text-center text-muted-foreground">None</td>
                <td className="py-2 px-3 text-center text-muted-foreground">None</td>
                <td className="py-2 px-3 text-center text-muted-foreground">None</td>
              </tr>
              <tr className="border-b border-muted">
                <td className="py-2 px-3 font-medium">Import listings</td>
                <td className="py-2 px-3 text-center font-semibold text-green-600">Free</td>
                <td className="py-2 px-3 text-center text-muted-foreground">N/A</td>
                <td className="py-2 px-3 text-center text-muted-foreground">N/A</td>
                <td className="py-2 px-3 text-center text-muted-foreground">N/A</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Add-ons */}
      <section className="text-center">
        <h2 className="text-2xl font-bold mb-4">Add-ons</h2>
        <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto text-left">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Finance Pro</CardTitle>
              <CardDescription>Full P&L, expense tracking, tax prep</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xl font-bold">{formatPrice(isAnnual ? 999 : 1499)}</span>
              <span className="text-sm text-muted-foreground">/mo</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Automation</CardTitle>
              <CardDescription>Auto-relist, smart price drops, Posh sharing</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xl font-bold">{formatPrice(isAnnual ? 999 : 1299)}</span>
              <span className="text-sm text-muted-foreground">/mo</span>
              <span className="text-xs text-muted-foreground block mt-1">2,000 actions/mo</span>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
