import Link from 'next/link';

const SETTINGS_NAV = [
  { href: '/my/settings', label: 'Profile' },
  { href: '/my/settings/notifications', label: 'Notifications' },
  { href: '/my/settings/security', label: 'Security' },
  { href: '/my/settings/privacy', label: 'Privacy & Data' },
  { href: '/my/settings/payments', label: 'Payments' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <nav className="flex gap-4 border-b pb-2 text-sm" aria-label="Settings navigation">
        {SETTINGS_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
