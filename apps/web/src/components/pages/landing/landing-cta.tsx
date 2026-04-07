import Link from 'next/link';

export function LandingCta() {
  return (
    <section className="cta-section reveal">
      <div className="cta-glow" />
      <div className="mx-auto max-w-[1380px] px-7 text-center relative z-10">
        <div className="section-label block text-center" style={{ color: 'var(--mg)' }}>
          Ready?
        </div>
        <h2 className="text-[clamp(36px,5vw,64px)] font-black tracking-[-0.03em] leading-[1.05] text-[var(--l-black)] mb-6">
          Buy. Sell.{' '}
          <em className="italic" style={{ color: 'var(--mg)' }}>
            Repeat.
          </em>
        </h2>
        <p className="text-[17px] text-[var(--l-muted)] max-w-[520px] mx-auto mb-10 leading-relaxed">
          Twicely combines social discovery, live drops, and pricing tools into
          one premium resale experience.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/auth/signup" className="btn-mg">
            Join the waitlist &rarr;
          </Link>
          <Link href="/become-seller" className="btn-ghost">
            Start selling free
          </Link>
        </div>
      </div>
    </section>
  );
}
