import Link from 'next/link';

interface QuickLink {
  label: string;
  href: string;
  description: string;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'Monetization & Fees', href: '/cfg/monetization', description: 'Platform fees, payouts & pricing' },
  { label: 'Trust & Safety', href: '/cfg/trust', description: 'Configure moderation' },
  { label: 'Meetup Locations', href: '/cfg/meetup-locations', description: 'Safe meetup spots for local sales' },
  { label: 'Modules', href: '/cfg/modules', description: 'Stripe, Shippo & integrations' },
  { label: 'Feature Flags', href: '/flags', description: 'Control rollouts' },
  { label: 'Jobs & Scheduler', href: '/cfg/jobs', description: 'Cron schedules & timing' },
  { label: 'Infrastructure', href: '/cfg/infrastructure', description: 'Valkey, Typesense, Centrifugo' },
];

export function SettingsQuickLinks() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {QUICK_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-lg bg-white p-4 shadow transition hover:shadow-md"
        >
          <p className="font-medium text-gray-900">{link.label}</p>
          <p className="text-sm text-gray-500">{link.description}</p>
        </Link>
      ))}
    </div>
  );
}
