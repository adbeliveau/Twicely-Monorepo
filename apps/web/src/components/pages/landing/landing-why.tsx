export function LandingWhy() {
  return (
    <section className="py-14 reveal">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="text-center mb-9">
          <div className="section-label text-center block">Why Twicely</div>
          <div className="section-title text-center">Not all resale is equal</div>
          <p className="text-[16px] text-[var(--l-muted)] mx-auto mt-2.5 max-w-[52ch] text-center leading-relaxed">
            We built the marketplace we always wished existed. Cleaner listings, verified sellers, smarter tools &mdash; all in one place.
          </p>
        </div>
        <div className="compare-grid grid grid-cols-2 gap-5">
          {/* For Buyers */}
          <div className="feature-card">
            <div className="section-label">For Buyers</div>
            <h2 className="font-black text-[24px] tracking-tight mb-2.5">A smarter way to discover and buy</h2>
            <p className="text-[15px] text-[var(--l-muted)] leading-relaxed mb-6">The feed learns your taste. Every card is shoppable. Every seller is trusted. Every purchase is protected.</p>
            <div className="flex flex-col">
              <div className="fli"><div className="fli-dot" /><div><strong className="block text-[14px] font-extrabold text-[var(--l-black)] mb-0.5">AI taste graph</strong><span className="text-[13px] text-[var(--l-muted)] leading-normal">Personalized feed built from your browsing, saves, and purchase history &mdash; not random inventory.</span></div></div>
              <div className="fli"><div className="fli-dot" /><div><strong className="block text-[14px] font-extrabold text-[var(--l-black)] mb-0.5">Offer on anything</strong><span className="text-[13px] text-[var(--l-muted)] leading-normal">One-tap offer on any listing. Sellers counter, accept, or decline in real time.</span></div></div>
              <div className="fli"><div className="fli-dot" /><div><strong className="block text-[14px] font-extrabold text-[var(--l-black)] mb-0.5">Visual-first listings</strong><span className="text-[13px] text-[var(--l-muted)] leading-normal">Photo-to-listing AI auto-generates titles, tags, and pricing suggestions from a single shot.</span></div></div>
              <div className="fli"><div className="fli-dot" /><div><strong className="block text-[14px] font-extrabold text-[var(--l-black)] mb-0.5">Fair resolution on every order</strong><span className="text-[13px] text-[var(--l-muted)] leading-normal">If there&rsquo;s a problem, Twicely reviews the facts and sides with whoever is right.</span></div></div>
            </div>
          </div>

          {/* For Sellers */}
          <div className="feature-card">
            <div className="section-label">For Sellers</div>
            <h2 className="font-black text-[24px] tracking-tight mb-2.5">Sell smarter. Reach further.</h2>
            <p className="text-[15px] text-[var(--l-muted)] leading-relaxed mb-6">Not just another place to manually post inventory. A real selling engine for serious resellers.</p>
            <div className="flex flex-col">
              <div className="fli"><div className="fli-dot" /><div><strong className="block text-[14px] font-extrabold text-[var(--l-black)] mb-0.5">Import existing listings</strong><span className="text-[13px] text-[var(--l-muted)] leading-normal">Bring your existing inventory from any platform in seconds instead of rebuilding from scratch.</span></div></div>
              <div className="fli"><div className="fli-dot" /><div><strong className="block text-[14px] font-extrabold text-[var(--l-black)] mb-0.5">Crosslist + auto-delist</strong><span className="text-[13px] text-[var(--l-muted)] leading-normal">Sell where it moves. Stop wasting time manually cleaning up sold inventory across platforms.</span></div></div>
              <div className="fli"><div className="fli-dot" /><div><strong className="block text-[14px] font-extrabold text-[var(--l-black)] mb-0.5">Analytics that actually sell faster</strong><span className="text-[13px] text-[var(--l-muted)] leading-normal">See what converts, what needs better presentation, and where demand actually exists.</span></div></div>
              <div className="fli"><div className="fli-dot" /><div><strong className="block text-[14px] font-extrabold text-[var(--l-black)] mb-0.5">Timed auctions + best offer rules</strong><span className="text-[13px] text-[var(--l-muted)] leading-normal">Let the market set the price, or set auto-accept and auto-decline thresholds and sell in your sleep.</span></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
