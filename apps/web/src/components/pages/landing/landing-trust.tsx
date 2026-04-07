import { Wallet, ShieldCheck, TrendingUp, Star } from 'lucide-react';

export function LandingTrust() {
  return (
    <section className="bg-white py-14 reveal">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="text-center mb-8">
          <div className="section-label text-center block">Built-in Trust</div>
          <div className="section-title text-center">Your money and<br /><em className="italic text-[var(--mg)]">reputation</em> are protected</div>
        </div>
        <div className="trust-grid">
          <div className="trust-cell">
            <div className="flex items-center gap-2.5 mb-2">
              <Wallet className="size-5 text-[var(--mg)] shrink-0" strokeWidth={2} />
              <div className="font-black text-[16px] tracking-tight">Twicely Guarantee</div>
            </div>
            <div className="text-[13px] text-[var(--l-muted)] leading-relaxed">If there&rsquo;s a problem, Twicely reviews the facts and sides with whoever is right.</div>
          </div>
          <div className="trust-cell">
            <div className="flex items-center gap-2.5 mb-2">
              <ShieldCheck className="size-5 text-[var(--mg)] shrink-0" strokeWidth={2} />
              <div className="font-black text-[16px] tracking-tight">Authentication Layer</div>
            </div>
            <div className="text-[13px] text-[var(--l-muted)] leading-relaxed">Luxury items over $500 go through verified authentication before they ship. Buyers receive a certificate.</div>
          </div>
          <div className="trust-cell">
            <div className="flex items-center gap-2.5 mb-2">
              <TrendingUp className="size-5 text-[var(--mg)] shrink-0" strokeWidth={2} />
              <div className="font-black text-[16px] tracking-tight">Price Intelligence</div>
            </div>
            <div className="text-[13px] text-[var(--l-muted)] leading-relaxed">90-day sold price history for comparable items. Know exactly what to charge before you list.</div>
          </div>
          <div className="trust-cell">
            <div className="flex items-center gap-2.5 mb-2">
              <Star className="size-5 text-[var(--mg)] shrink-0" strokeWidth={2} />
              <div className="font-black text-[16px] tracking-tight">Seller Reputation</div>
            </div>
            <div className="text-[13px] text-[var(--l-muted)] leading-relaxed">Multi-factor scores beyond star ratings &mdash; response time, accuracy, shipping speed, dispute history.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
