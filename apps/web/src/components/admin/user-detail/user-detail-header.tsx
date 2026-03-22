import Link from 'next/link';
import type { UserDetailFull } from '@/lib/queries/admin-users';

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'Never';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    suspended: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    SUSPENDED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    banned: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    BANNED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  const label = status === 'ACTIVE' || status === 'active' ? 'ACTIVE'
    : status === 'SUSPENDED' || status === 'suspended' ? 'SUSPENDED' : 'BANNED';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.ACTIVE}`}>
      {label}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    NONE: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    STARTER: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
    PRO: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    POWER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    ENTERPRISE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[tier] ?? colors.NONE}`}>
      {tier}
    </span>
  );
}

function BandBadge({ band }: { band: string }) {
  const colors: Record<string, string> = {
    POWER_SELLER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    TOP_RATED: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
    ESTABLISHED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    EMERGING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[band] ?? colors.EMERGING}`}>
      {band.replace(/_/g, ' ')}
    </span>
  );
}

interface UserDetailHeaderProps {
  user: UserDetailFull;
  actions: React.ReactNode;
}

export function UserDetailHeader({ user, actions }: UserDetailHeaderProps) {
  const displayName = user.business?.businessName ?? user.name;
  const isBanned = user.isBanned;
  const userStatus = isBanned ? 'BANNED' : 'ACTIVE';
  const isVerified = !!user.seller?.verifiedAt;

  return (
    <div className="mb-6">
      {/* Back link */}
      <Link
        href="/usr"
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      >
        <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Users
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Avatar + info */}
        <div className="flex items-start gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={displayName}
              className="h-20 w-20 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30">
              <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                {getInitial(displayName)}
              </span>
            </div>
          )}
          <div>
            {/* Line 1: Name + verified checkmark */}
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayName}
              </h1>
              {isVerified && (
                <span className="text-brand-500" title="Verified Seller">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </div>

            {/* Line 2: Status badges */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={userStatus} />
              {user.isSeller && user.seller?.storeTier && (
                <TierBadge tier={user.seller.storeTier} />
              )}
              {user.seller?.performanceBand && user.seller.performanceBand !== 'EMERGING' && (
                <BandBadge band={user.seller.performanceBand} />
              )}
              {isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  ID Verified
                </span>
              )}
            </div>

            {/* Line 3: User ID */}
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              ID: {user.id.slice(0, 8)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {actions}
        </div>
      </div>
    </div>
  );
}

interface UserInfoBarProps {
  user: UserDetailFull;
}

export function UserInfoBar({ user }: UserInfoBarProps) {
  const isBusiness = !!user.business;

  return (
    <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {isBusiness ? (
          <>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Owner
              </dt>
              <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {user.displayName ?? user.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Legal Name
              </dt>
              <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {user.business?.businessName ?? '--'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Business Type
              </dt>
              <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {user.business?.businessType?.replace(/_/g, ' ') ?? 'Not set'}
              </dd>
            </div>
          </>
        ) : (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Full Name
            </dt>
            <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {user.displayName ?? user.name}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Email
          </dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {user.email}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Phone
          </dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {user.phone ?? 'Not set'}
          </dd>
        </div>
        {user.isSeller && user.storefront && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Store
            </dt>
            <dd className="mt-1 text-sm font-medium">
              <span className="text-gray-900 dark:text-white">
                {user.storefront.name ?? '--'}
              </span>
              {user.storefront.slug && (
                <Link
                  href={`/st/${user.storefront.slug}`}
                  className="ml-1.5 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  target="_blank"
                >
                  /{user.storefront.slug}
                </Link>
              )}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Member Since
          </dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {formatDate(user.createdAt)}
          </dd>
        </div>
        {user.addresses.length > 0 ? (
          <div className="col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Address
            </dt>
            <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {user.addresses?.[0]?.city}, {user.addresses?.[0]?.state} {user.addresses?.[0]?.zip}
            </dd>
          </div>
        ) : (
          <div className="col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Address
            </dt>
            <dd className="mt-1 text-sm italic text-gray-400 dark:text-gray-500">Not set</dd>
          </div>
        )}
      </div>
    </div>
  );
}
