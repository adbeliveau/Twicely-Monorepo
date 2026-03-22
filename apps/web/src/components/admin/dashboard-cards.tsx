/**
 * Dashboard card components -- V2 corp dashboard visual style.
 * Big stat cards, attention rows, quick links grid, chart cards.
 */

import Link from 'next/link';
import { DashboardBarChart } from './dashboard-bar-chart';
import {
  UsersIcon,
  ShoppingBagIcon,
  DollarIcon,
  GearIcon,
  AlertTriangleIcon,
  ClockIcon,
  ChevronRightIcon,
} from './dashboard-icons';

/* ─── V2-style stat card ─────────────────────────────────────────────── */

export function DashboardStatCard({
  label,
  value,
  subtitle,
  iconBg,
  iconColor,
  icon,
  link,
}: {
  label: string;
  value: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  link?: { href: string; label: string };
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {subtitle}
          </p>
        </div>
        <div className={`rounded-full p-3 ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
      </div>
      {link && (
        <div className="mt-4">
          <Link
            href={link.href}
            className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            {link.label} &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─── Requires Attention panel ───────────────────────────────────────── */

function AttentionRow({
  href,
  bgColor,
  iconColor,
  icon,
  title,
  description,
}: {
  href: string;
  bgColor: string;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
    >
      <div className="flex items-center gap-3">
        <div className={`rounded-full p-2 ${bgColor}`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{title}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
      <ChevronRightIcon />
    </Link>
  );
}

export function RequiresAttention({
  openCases,
  scheduledMeetups,
}: {
  openCases: number;
  scheduledMeetups: number;
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
        Requires Attention
      </h2>
      <div className="space-y-3">
        <AttentionRow
          href="/mod/disputes"
          bgColor="bg-red-100 dark:bg-red-900/20"
          iconColor="text-red-600 dark:text-red-400"
          icon={<AlertTriangleIcon />}
          title={`${openCases} Open Cases`}
          description="Awaiting staff action"
        />
        <AttentionRow
          href="/tx/orders"
          bgColor="bg-yellow-100 dark:bg-yellow-900/20"
          iconColor="text-yellow-600 dark:text-yellow-400"
          icon={<ClockIcon />}
          title={`${scheduledMeetups} Local Meetups`}
          description="Scheduled for today"
        />
      </div>
    </div>
  );
}

/* ─── Quick Links grid ───────────────────────────────────────────────── */

export function DashboardQuickLinks() {
  const links = [
    { href: '/usr', label: 'Users', bg: 'bg-brand-100 dark:bg-brand-900/20', color: 'text-brand-600 dark:text-brand-400', icon: <UsersIcon /> },
    { href: '/tx/orders', label: 'Orders', bg: 'bg-green-100 dark:bg-green-900/20', color: 'text-green-600 dark:text-green-400', icon: <ShoppingBagIcon /> },
    { href: '/fin', label: 'Finance', bg: 'bg-purple-100 dark:bg-purple-900/20', color: 'text-purple-600 dark:text-purple-400', icon: <DollarIcon /> },
    { href: '/cfg', label: 'Settings', bg: 'bg-gray-100 dark:bg-gray-700', color: 'text-gray-600 dark:text-gray-400', icon: <GearIcon /> },
  ];

  return (
    <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
        Quick Links
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-gray-200 p-4 text-center transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <div className={`mx-auto mb-2 w-fit rounded-full p-3 ${l.bg}`}>
              <div className={l.color}>{l.icon}</div>
            </div>
            <p className="font-medium text-gray-900 dark:text-white">
              {l.label}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Chart card wrapper ─────────────────────────────────────────────── */

export function DashboardChartCard({
  title,
  data,
  formatKind,
  barColor,
}: {
  title: string;
  data: { date: string; value: number }[];
  formatKind?: 'cents' | 'number';
  barColor: string;
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
      <DashboardBarChart
        data={data}
        formatKind={formatKind}
        barColor={barColor}
        emptyMessage="No data yet"
      />
    </div>
  );
}
