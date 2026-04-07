import { Scale, BadgeCheck, Search, Zap, ClipboardList, type LucideIcon } from 'lucide-react';

const VALUE_ITEMS: Array<{ Icon: LucideIcon; text: string; sub: string }> = [
  { Icon: Scale, text: 'Fair Resolution', sub: 'We side with whoever is right' },
  { Icon: BadgeCheck, text: 'Verified Sellers', sub: 'Trust scores on every profile' },
  { Icon: Search, text: 'Authentication', sub: 'Luxury items verified' },
  { Icon: Zap, text: 'Smart Selling Tools', sub: 'Import, crosslist, auto-delist' },
  { Icon: ClipboardList, text: 'Clean Listings', sub: 'Quality-controlled inventory' },
];

export function LandingValueStrip() {
  return (
    <div className="value-strip">
      <div className="mx-auto max-w-[1380px] px-7">
        <div className="value-strip-inner flex items-center justify-around gap-3">
          {VALUE_ITEMS.map(({ Icon, text, sub }, i) => (
            <div key={text} className="contents">
              {i > 0 && <div className="vs-divider" />}
              <div className="flex items-center gap-2.5">
                <div className="vs-icon">
                  <Icon className="size-[18px] text-[var(--mg)]" strokeWidth={2} />
                </div>
                <div>
                  <div className="text-[13px] font-extrabold text-white">{text}</div>
                  <div className="text-[11px] text-white/45 mt-px">{sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
