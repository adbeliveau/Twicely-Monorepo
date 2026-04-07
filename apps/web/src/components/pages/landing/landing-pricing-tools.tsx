import { Tag, Zap, Handshake } from 'lucide-react';

export function LandingPricingTools() {
  return (
    <section className="bg-white py-14 reveal">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="text-center">
          <div className="section-label text-center block">Pricing Tools</div>
          <div className="section-title text-center">Every way to sell,<br />in <em className="italic text-[var(--mg)]">one platform</em></div>
          <p className="text-[16px] text-[var(--l-muted)] mx-auto mt-3 max-w-[52ch] text-center leading-relaxed">
            Fixed price? Auction? Best offer? Bundle? Twicely handles all of it &mdash; with smart auto-thresholds so you can run 500 listings without checking your phone every 5 minutes.
          </p>
        </div>
        <div className="pricing-grid grid grid-cols-3 gap-5 mt-10">
          <div className="pricing-card">
            <div className="flex items-center gap-2.5 mb-2.5">
              <Tag className="size-5 text-[var(--mg)] shrink-0" strokeWidth={2} />
              <div className="font-black text-[19px] tracking-tight">Fixed Price</div>
            </div>
            <p className="text-[14px] text-[var(--l-muted)] leading-relaxed mb-4">Set your price, list it, sell it. Clean and simple for high-volume sellers who know their market and don&apos;t want to manage bids.</p>
            <span className="pc-tag">Always available</span>
          </div>
          <div className="pricing-card featured">
            <div className="flex items-center gap-2.5 mb-2.5">
              <Zap className="size-5 text-[var(--mg)] shrink-0" strokeWidth={2} />
              <div className="font-black text-[19px] tracking-tight">Timed Auctions</div>
            </div>
            <p className="text-[14px] text-[var(--l-muted)] leading-relaxed mb-4">Let the market set the price. Timed auctions create urgency and bidding wars &mdash; perfect for rare, limited, or high-demand items. Buyers set max bids; Twicely auto-bids for them.</p>
            <span className="pc-tag mg">Fan favorite</span>
          </div>
          <div className="pricing-card">
            <div className="flex items-center gap-2.5 mb-2.5">
              <Handshake className="size-5 text-[var(--mg)] shrink-0" strokeWidth={2} />
              <div className="font-black text-[19px] tracking-tight">Best Offer + Auto-Rules</div>
            </div>
            <p className="text-[14px] text-[var(--l-muted)] leading-relaxed mb-4">Set your floor price and let Twicely handle negotiations. Auto-accept above threshold. Auto-decline below it. Counter in between. Sell in your sleep.</p>
            <span className="pc-tag">Smart negotiation</span>
          </div>
        </div>
      </div>
    </section>
  );
}
