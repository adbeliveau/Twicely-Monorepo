import type { UserDetailFull } from '@/lib/queries/admin-users';

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function dt(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString() : '—';
}

function BandBadge({ band }: { band: string }) {
  const colors: Record<string, string> = {
    POWER_SELLER: 'bg-purple-100 text-purple-700 border border-purple-200',
    TOP_RATED: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    ESTABLISHED: 'bg-green-100 text-green-700 border border-green-200',
    EMERGING: 'bg-gray-100 text-gray-600 border border-gray-200',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[band] ?? colors['EMERGING']}`}>
      {band.replace('_', ' ')}
    </span>
  );
}

function StatusBadge({ status, ok, warn, bad }: { status: string; ok: string; warn?: string; bad?: string }) {
  const isOk = status === ok;
  const isWarn = warn && status === warn;
  const cls = isOk
    ? 'bg-green-100 text-green-700'
    : isWarn
      ? 'bg-yellow-100 text-yellow-700'
      : bad
        ? 'bg-red-100 text-red-700'
        : 'bg-gray-100 text-gray-600';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between py-0.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

interface Props { user: UserDetailFull }

export function UserOverviewTab({ user: u }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Account Card */}
        <Card title="Account">
          <dl className="space-y-0.5">
            <Row label="Username">{u.username ?? '—'}</Row>
            <Row label="Display name">{u.displayName ?? '—'}</Row>
            <Row label="Email">
              {u.email}
              {u.emailVerified && <span className="ml-1 text-xs text-green-600">(verified)</span>}
            </Row>
            <Row label="Phone">
              {u.phone ?? '—'}
              {u.phone && u.phoneVerified && <span className="ml-1 text-xs text-green-600">(verified)</span>}
            </Row>
            <Row label="Status">
              <StatusBadge status={u.isBanned ? 'Banned' : 'Active'} ok="Active" bad="Banned" />
            </Row>
            <Row label="Buyer tier">{u.buyerQualityTier}</Row>
            <Row label="Marketing opt-in">{u.marketingOptIn ? 'Yes' : 'No'}</Row>
            <Row label="Credit balance">{fmt(u.creditBalanceCents)}</Row>
            <Row label="Joined">{dt(u.createdAt)}</Row>
            {u.deletionRequestedAt && <Row label="Deletion requested">{dt(u.deletionRequestedAt)}</Row>}
          </dl>
        </Card>

        {/* Seller Card */}
        {u.seller && (
          <Card title="Seller">
            <dl className="space-y-0.5">
              <Row label="Type">{u.seller.sellerType}</Row>
              <Row label="Status">
                <StatusBadge status={u.seller.status} ok="ACTIVE" warn="RESTRICTED" bad="SUSPENDED" />
              </Row>
              <Row label="Performance band"><BandBadge band={u.seller.performanceBand} /></Row>
              <Row label="Seller score">{u.seller.sellerScore} / 1000</Row>
              <Row label="Trust score">{u.seller.trustScore}</Row>
              <Row label="Enforcement">{u.seller.enforcementLevel ?? '—'}</Row>
              <Row label="Vacation mode">{u.seller.vacationMode ? 'On' : 'Off'}</Row>
              <Row label="Handling time">{u.seller.handlingTimeDays} days</Row>
              <Row label="Payouts enabled">{u.seller.payoutsEnabled ? 'Yes' : 'No'}</Row>
              <Row label="Activated">{dt(u.seller.activatedAt)}</Row>
              <Row label="Verified">{dt(u.seller.verifiedAt)}</Row>
              <Row label="New seller">{u.seller.isNew ? 'Yes' : 'No'}</Row>
            </dl>
          </Card>
        )}

        {/* Subscriptions Card */}
        {u.seller && (
          <Card title="Subscriptions">
            <dl className="space-y-0.5">
              <Row label="Store tier">{u.seller.storeTier}</Row>
              {u.storeSubscription && <>
                <Row label="Store status">{u.storeSubscription.status}</Row>
                <Row label="Period ends">{dt(u.storeSubscription.currentPeriodEnd)}</Row>
                {u.storeSubscription.trialEndsAt && <Row label="Trial ends">{dt(u.storeSubscription.trialEndsAt)}</Row>}
              </>}
              <Row label="Lister tier">{u.seller.listerTier}</Row>
              {u.listerSubscription && <Row label="Lister status">{u.listerSubscription.status}</Row>}
              <Row label="Automation">{u.seller.hasAutomation ? 'Yes' : 'No'}</Row>
              <Row label="Finance tier">{u.seller.financeTier}</Row>
              <Row label="Bundle tier">{u.seller.bundleTier}</Row>
              <Row label="Boost credits">{fmt(u.seller.boostCreditCents)}</Row>
              <Row label="Stripe account">{u.seller.stripeAccountId ?? '—'}</Row>
              <Row label="Stripe onboarded">
                <StatusBadge status={u.seller.stripeOnboarded ? 'Yes' : 'No'} ok="Yes" />
              </Row>
            </dl>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Business Card */}
        {u.business && (
          <Card title="Business">
            <dl className="space-y-0.5">
              <Row label="Name">{u.business.businessName}</Row>
              <Row label="Type">{u.business.businessType}</Row>
              <Row label="Location">{u.business.city}, {u.business.state}, {u.business.country}</Row>
              {u.business.phone && <Row label="Phone">{u.business.phone}</Row>}
              {u.business.website && <Row label="Website">{u.business.website}</Row>}
            </dl>
          </Card>
        )}

        {/* Balance Card */}
        {u.seller && (
          <Card title="Earnings">
            <dl className="space-y-0.5">
              <Row label="Available for payout">{u.balance ? fmt(u.balance.availableCents) : '$0.00'}</Row>
              <Row label="Pending">{u.balance ? fmt(u.balance.pendingCents) : '$0.00'}</Row>
              <Row label="Reserved">{u.balance ? fmt(u.balance.reservedCents) : '$0.00'}</Row>
            </dl>
          </Card>
        )}

        {/* Band Override Card */}
        {u.seller?.bandOverride && (
          <Card title="Performance Band Override">
            <dl className="space-y-0.5">
              <Row label="Override band"><BandBadge band={u.seller.bandOverride} /></Row>
              <Row label="Reason">{u.seller.bandOverrideReason ?? '—'}</Row>
              <Row label="Expires">{dt(u.seller.bandOverrideExpiresAt)}</Row>
              <Row label="Set by">{u.seller.bandOverrideBy ?? '—'}</Row>
            </dl>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Addresses */}
        {u.addresses.length > 0 && (
          <Card title="Addresses">
            <ul className="divide-y divide-gray-100">
              {u.addresses.map((addr) => (
                <li key={addr.id} className="flex items-start justify-between py-1.5 text-sm">
                  <span>
                    {addr.label && <span className="mr-1 text-gray-400">[{addr.label}]</span>}
                    {addr.city}, {addr.state} {addr.zip}
                  </span>
                  {addr.isDefault && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">Default</span>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Storefront */}
        {u.storefront && (
          <Card title="Storefront">
            <dl className="space-y-0.5">
              <Row label="Name">{u.storefront.name ?? '—'}</Row>
              <Row label="Slug">
                {u.storefront.slug
                  ? <a href={`/st/${u.storefront.slug}`} className="text-primary underline" target="_blank" rel="noreferrer">/st/{u.storefront.slug}</a>
                  : '—'}
              </Row>
              <Row label="Published">
                <StatusBadge status={u.storefront.isPublished ? 'Yes' : 'No'} ok="Yes" />
              </Row>
            </dl>
          </Card>
        )}
      </div>
    </div>
  );
}
