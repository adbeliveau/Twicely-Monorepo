import type { UserDetailFull } from '@/lib/queries/admin-users';

function dt(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never';
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function VerifiedText({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
      <CheckIcon />
      {label}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    NONE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    STARTER: 'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400',
    PRO: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
    POWER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    ENTERPRISE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[tier] ?? colors.NONE}`}>
      {tier}
    </span>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
      <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="p-6">
        <dl className="space-y-3">{children}</dl>
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

interface Props {
  user: UserDetailFull;
}

export function OverviewInfoCards({ user: u }: Props) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {/* Verification Status */}
      <InfoCard title="Verification Status">
        <InfoRow label="Email">
          {u.emailVerified ? (
            <VerifiedText label="Verified" />
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">Not verified</span>
          )}
        </InfoRow>
        <InfoRow label="Phone">
          {u.phoneVerified ? (
            <VerifiedText label="Verified" />
          ) : u.phone ? (
            <span className="text-sm text-yellow-600 dark:text-yellow-400">Not verified</span>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">Not set</span>
          )}
        </InfoRow>
        {u.isSeller && (
          <InfoRow label="Seller Verified">
            {u.seller?.verifiedAt ? (
              <VerifiedText label="Yes" />
            ) : (
              <span className="text-sm text-yellow-600 dark:text-yellow-400">Pending</span>
            )}
          </InfoRow>
        )}
        {u.isSeller && (
          <InfoRow label="Identity">
            {u.seller?.verifiedAt ? (
              <VerifiedText label="Verified" />
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">Not verified</span>
            )}
          </InfoRow>
        )}
      </InfoCard>

      {/* Subscription (sellers only) */}
      {u.isSeller && u.storeSubscription ? (
        <InfoCard title="Subscription">
          <InfoRow label="Tier">
            <TierBadge tier={u.storeSubscription.tier} />
          </InfoRow>
          <InfoRow label="Status">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              u.storeSubscription.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
              u.storeSubscription.status === 'PAST_DUE' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>{u.storeSubscription.status}</span>
          </InfoRow>
          {u.storeSubscription.currentPeriodEnd && (
            <InfoRow label="Renews">
              <span className="text-sm text-gray-900 dark:text-white">{dt(u.storeSubscription.currentPeriodEnd)}</span>
            </InfoRow>
          )}
        </InfoCard>
      ) : u.isSeller ? (
        <InfoCard title="Subscription">
          <InfoRow label="Store Tier">
            <TierBadge tier={u.seller?.storeTier ?? 'NONE'} />
          </InfoRow>
          <InfoRow label="Lister Tier">
            <TierBadge tier={u.seller?.listerTier ?? 'NONE'} />
          </InfoRow>
        </InfoCard>
      ) : null}

      {/* Payout Status (sellers only) */}
      {u.isSeller && u.balance && (
        <InfoCard title="Payout Status">
          <InfoRow label="Payouts">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              u.seller?.payoutsEnabled ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
            }`}>{u.seller?.payoutsEnabled ? 'ENABLED' : 'PENDING'}</span>
          </InfoRow>
          <InfoRow label="Available">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{fmt(u.balance.availableCents)}</span>
          </InfoRow>
          {u.balance.reservedCents > 0 && (
            <InfoRow label="On Hold">
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{fmt(u.balance.reservedCents)}</span>
            </InfoRow>
          )}
        </InfoCard>
      )}

      {/* Settings (sellers only) */}
      {u.isSeller && u.seller && (
        <InfoCard title="Settings">
          <InfoRow label="Handling">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{u.seller.handlingTimeDays} days</span>
          </InfoRow>
          <InfoRow label="Vacation">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              u.seller.vacationMode ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>{u.seller.vacationMode ? 'On' : 'Off'}</span>
          </InfoRow>
          <InfoRow label="Performance">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              u.seller.performanceBand === 'POWER_SELLER' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
              u.seller.performanceBand === 'TOP_RATED' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400' :
              u.seller.performanceBand === 'SUSPENDED' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}>{u.seller.performanceBand.replace(/_/g, ' ')}</span>
          </InfoRow>
        </InfoCard>
      )}
    </div>
  );
}
