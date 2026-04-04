import type { UserDetailFull } from '@/lib/queries/admin-users';

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dt(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never';
}

function PurchasesIcon() {
  return (
    <svg className="h-6 w-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

function ReviewsIcon() {
  return (
    <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function SalesIcon() {
  return (
    <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ListingsIcon() {
  return (
    <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  subtitleColor?: string;
}

function StatCard({ label, value, subtitle, icon, iconBg, subtitleColor }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className={`mt-1.5 text-sm ${subtitleColor ?? 'text-gray-500 dark:text-gray-400'}`}>
            {subtitle}
          </p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface Props {
  user: UserDetailFull;
  orderCount?: number;
}

export function OverviewStatCards({ user: u, orderCount = 0 }: Props) {
  const accountAgeDays = Math.floor((new Date().getTime() - u.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const totalBalance = u.balance
    ? u.balance.availableCents + u.balance.pendingCents + u.balance.reservedCents
    : 0;

  return (
    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
      {/* Purchases Card */}
      <StatCard
        label="Purchases"
        value={orderCount}
        subtitle={`${fmt(u.creditBalanceCents)} credit balance`}
        icon={<PurchasesIcon />}
        iconBg="bg-brand-100 dark:bg-brand-900/30"
      />

      {/* Account Card */}
      <StatCard
        label="Account Age"
        value={`${accountAgeDays}d`}
        subtitle={`Since ${dt(u.createdAt)}`}
        icon={u.isSeller ? <ReviewsIcon /> : <CalendarIcon />}
        iconBg={u.isSeller ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-gray-100 dark:bg-gray-700'}
      />

      {/* Sales or Buyer status */}
      {u.seller ? (
        <StatCard
          label="Total Sales"
          value={fmt(totalBalance)}
          subtitle={`Score: ${u.seller.sellerScore} / 1000`}
          icon={<SalesIcon />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          subtitleColor="text-emerald-600 font-medium"
        />
      ) : (
        <StatCard
          label="Credit Balance"
          value={fmt(u.creditBalanceCents)}
          subtitle={u.emailVerified ? 'Email verified' : 'Email not verified'}
          icon={<SalesIcon />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
        />
      )}

      {/* Listings or Last Active */}
      {u.seller ? (
        <StatCard
          label="Performance"
          value={u.seller.performanceBand.replace(/_/g, ' ')}
          subtitle={`Trust: ${u.seller.trustScore}`}
          icon={<ListingsIcon />}
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          subtitleColor="text-purple-600 font-medium"
        />
      ) : (
        <StatCard
          label="Purchases"
          value={u.completedPurchaseCount ?? 0}
          subtitle={u.marketingOptIn ? 'Marketing opt-in' : 'No marketing'}
          icon={<ClockIcon />}
          iconBg="bg-gray-100 dark:bg-gray-700"
        />
      )}
    </div>
  );
}
