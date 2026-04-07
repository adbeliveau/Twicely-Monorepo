const ITEMS = [
  'Social Discovery', 'Live Drop Events', 'Bundle Deals', 'Timed Auctions',
  'Best Offer', 'Seller Analytics', 'AI Listing Tools', 'Buyer Protection',
  'Price Intelligence', 'Authentication',
];

export function LandingTicker() {
  const repeated = [...ITEMS, ...ITEMS];

  return (
    <div className="ticker-wrap">
      <div className="ticker-track">
        {repeated.map((item, i) => (
          <span key={i} className="text-[12px] font-extrabold text-white px-5 whitespace-nowrap tracking-[0.1em] uppercase">
            {item}<span className="text-white/50 ml-5">&middot;</span>
          </span>
        ))}
      </div>
    </div>
  );
}
