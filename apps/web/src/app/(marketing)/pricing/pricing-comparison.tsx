'use client';

/**
 * Competitor comparison table for the pricing page.
 * Split from pricing-toggle.tsx to stay under 300 lines.
 */

function formatRateBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

interface PricingComparisonProps {
  tfBrackets: Array<{ maxCents: number; rateBps: number }>;
}

export function PricingComparison({ tfBrackets }: PricingComparisonProps) {
  return (
    <section className="tw-feature-card">
      <div className="text-center mb-8">
        <div className="tw-section-label">Comparison</div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--tw-black)]">
          How we <em className="not-italic text-[var(--mg)]">compare</em>
        </h2>
      </div>
      <div className="max-w-3xl mx-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--tw-border)]">
              <th className="text-left py-3 px-3"></th>
              <th className="py-3 px-3 text-center font-extrabold text-[var(--mg)] uppercase text-[11px] tracking-wider">Twicely</th>
              <th className="py-3 px-3 text-center font-extrabold text-[var(--tw-muted)] uppercase text-[11px] tracking-wider">eBay</th>
              <th className="py-3 px-3 text-center font-extrabold text-[var(--tw-muted)] uppercase text-[11px] tracking-wider">Poshmark</th>
              <th className="py-3 px-3 text-center font-extrabold text-[var(--tw-muted)] uppercase text-[11px] tracking-wider">Mercari</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--tw-border)]">
              <td className="py-3 px-3 font-bold text-[var(--tw-black)]">Seller fee</td>
              <td className="py-3 px-3 text-center font-extrabold text-[var(--tw-green)]">
                {tfBrackets.length > 0 ? formatRateBps(tfBrackets[tfBrackets.length - 1]!.rateBps) : '8.0%'}-{tfBrackets.length > 0 ? formatRateBps(Math.max(...tfBrackets.map(b => b.rateBps))) : '11.0%'} TF
              </td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted)]">12.9%+</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted)]">20%</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted)]">10% + $0.50</td>
            </tr>
            <tr className="border-b border-[var(--tw-border)]">
              <td className="py-3 px-3 font-bold text-[var(--tw-black)]">Monthly sub</td>
              <td className="py-3 px-3 text-center font-extrabold text-[var(--tw-green)]">From $0</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted)]">$0–$21.95</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted)]">$0</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted)]">$0</td>
            </tr>
            <tr className="border-b border-[var(--tw-border)]">
              <td className="py-3 px-3 font-bold text-[var(--tw-black)]">Crosslisting</td>
              <td className="py-3 px-3 text-center font-extrabold text-[var(--tw-green)]">Built-in</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted-lt)]">None</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted-lt)]">None</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted-lt)]">None</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-[var(--tw-black)]">Import listings</td>
              <td className="py-3 px-3 text-center font-extrabold text-[var(--tw-green)]">Free</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted-lt)]">N/A</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted-lt)]">N/A</td>
              <td className="py-3 px-3 text-center text-[var(--tw-muted-lt)]">N/A</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
