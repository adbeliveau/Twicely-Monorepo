import Link from 'next/link';
import { SETTINGS_SUB_NAV } from '@/lib/hub/hub-nav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <nav className="flex gap-4 border-b pb-2 text-sm" aria-label="Settings navigation">
        {SETTINGS_SUB_NAV.map((item) => (
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
