import Link from 'next/link';

export function Logo({ size = 'default' }: { size?: 'default' | 'sm' }) {
  const textClass = size === 'sm' ? 'text-[30px]' : 'text-[36px]';
  const tagClass = size === 'sm' ? 'text-[8px]' : 'text-[9px]';

  return (
    <Link href="/" className="inline-flex flex-col items-center" aria-label="Twicely home">
      <span className={`${textClass} font-black tracking-[0.05em] leading-none text-foreground`}>
        T<span className="text-brand-500">W</span>ICELY
      </span>
      <span className={`${tagClass} font-extrabold tracking-[0.3em] uppercase text-brand-500 mt-0.5`}>
        Buy &middot; Sell &middot; Repeat
      </span>
    </Link>
  );
}
