import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAffiliateDetailForAdmin } from '@/lib/queries/affiliate-admin';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getCommissionsForAdmin, getPayoutsForAdmin } from '@/lib/queries/affiliate-payout-admin';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AffiliateApprovalForm } from '@/components/hub/affiliate-approval-form';
import { AffiliateAdminActions } from '@/components/hub/affiliate-admin-actions';
import { AffiliateCommissionTable } from '@/components/hub/affiliate-commission-table';
import { AffiliatePayoutTable } from '@/components/hub/affiliate-payout-table';
import { AffiliateCommissionRateEditor } from '@/components/hub/affiliate-commission-rate-editor';
import { AffiliateFraudPanel } from '@/components/hub/affiliate-fraud-panel';
import {
  getAffiliateFraudSignals,
  getAffiliateFraudSummary,
  getRelatedAccountsByIp,
} from '@/lib/queries/affiliate-fraud';

export const metadata: Metadata = { title: 'Affiliate Detail | Twicely Hub' };

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

function parseApplicationNote(note: string | null): {
  text: string;
  socialLinks: Record<string, string> | null;
  audienceSize: number | null;
} {
  if (!note) return { text: '', socialLinks: null, audienceSize: null };
  try {
    const parsed = JSON.parse(note) as {
      note?: string;
      socialLinks?: Record<string, string> | null;
      audienceSize?: number | null;
    };
    return {
      text: parsed.note ?? note,
      socialLinks: parsed.socialLinks ?? null,
      audienceSize: parsed.audienceSize ?? null,
    };
  } catch {
    return { text: note, socialLinks: null, audienceSize: null };
  }
}

export default async function AffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();

  if (!ability.can('manage', 'Affiliate')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const detail = await getAffiliateDetailForAdmin(id);
  if (!detail) notFound();

  const [
    defaultCommissionBps,
    defaultCookieDays,
    defaultDurationMonths,
    initialCommissions,
    initialPayouts,
    fraudSignals,
    fraudSummary,
    relatedAccounts,
  ] = await Promise.all([
    getPlatformSetting('affiliate.influencer.defaultCommissionRateBps', 2500),
    getPlatformSetting('affiliate.influencer.cookieDays', 60),
    getPlatformSetting('affiliate.commissionDurationMonths', 12),
    getCommissionsForAdmin({ affiliateId: id, limit: 10, offset: 0 }),
    getPayoutsForAdmin({ affiliateId: id, limit: 10, offset: 0 }),
    getAffiliateFraudSignals(id),
    getAffiliateFraudSummary(id),
    getRelatedAccountsByIp(detail.userId),
  ]);

  const parsedNote = parseApplicationNote(detail.applicationNote);
  const isPendingInfluencer = detail.tier === 'INFLUENCER' && detail.status === 'PENDING';

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={detail.username ?? detail.displayName ?? 'Unknown'}
        description={detail.email ?? ''}
      />

      <div className="flex items-center gap-3">
        <Link href="/usr/affiliates" className="text-sm text-primary hover:text-primary/80">
          ← Back to Affiliates
        </Link>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
          detail.tier === 'INFLUENCER' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {detail.tier}
        </span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
          detail.status === 'ACTIVE'
            ? 'bg-green-100 text-green-700'
            : detail.status === 'PENDING'
            ? 'bg-yellow-100 text-yellow-700'
            : detail.status === 'SUSPENDED'
            ? 'bg-orange-100 text-orange-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {detail.status}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase text-primary">Affiliate Info</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Referral Code</dt>
              <dd className="font-mono">{detail.referralCode}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Commission Rate</dt>
              <dd>{formatBps(detail.commissionRateBps)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Cookie Duration</dt>
              <dd>{detail.cookieDurationDays} days</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Commission Duration</dt>
              <dd>{detail.commissionDurationMonths} months</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Warnings</dt>
              <dd>{detail.warningCount}</dd>
            </div>
            {detail.suspendedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Suspended At</dt>
                <dd>{detail.suspendedAt.toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase text-primary">Stats</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Referrals</dt>
              <dd>{detail.referralCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Conversions</dt>
              <dd>{detail.conversionCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Earned</dt>
              <dd>{formatCents(detail.totalEarnedCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Pending</dt>
              <dd>{formatCents(detail.pendingBalanceCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Available for Payout</dt>
              <dd>{formatCents(detail.availableBalanceCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Paid</dt>
              <dd>{formatCents(detail.totalPaidCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Promo Codes</dt>
              <dd>{detail.promoCodeCount}</dd>
            </div>
          </dl>
        </div>
      </div>

      {isPendingInfluencer && detail.applicationNote && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-yellow-800">Influencer Application</h3>
          <div>
            <p className="text-xs font-medium text-yellow-700 mb-1">Application Note</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{parsedNote.text}</p>
          </div>
          {parsedNote.audienceSize !== null && (
            <div>
              <p className="text-xs font-medium text-yellow-700">Self-Reported Audience Size</p>
              <p className="text-sm">{parsedNote.audienceSize.toLocaleString()}</p>
            </div>
          )}
          {parsedNote.socialLinks && (
            <div>
              <p className="text-xs font-medium text-yellow-700 mb-1">Social Links</p>
              <ul className="space-y-1">
                {Object.entries(parsedNote.socialLinks).map(([platform, url]) => (
                  url && (
                    <li key={platform}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline capitalize"
                      >
                        {platform}: {url}
                      </a>
                    </li>
                  )
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {isPendingInfluencer && (
        <AffiliateApprovalForm
          affiliateId={detail.id}
          defaultCommissionRateBps={defaultCommissionBps}
          defaultCookieDurationDays={defaultCookieDays}
          defaultCommissionDurationMonths={defaultDurationMonths}
        />
      )}

      {(detail.status === 'ACTIVE' || detail.status === 'SUSPENDED') && (
        <AffiliateAdminActions affiliateId={detail.id} status={detail.status} />
      )}

      {detail.status === 'ACTIVE' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase text-primary">Commission Rate</h3>
          <AffiliateCommissionRateEditor
            affiliateId={detail.id}
            currentRateBps={detail.commissionRateBps}
            tier={detail.tier}
          />
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-primary">Commissions</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {initialCommissions.total}
          </span>
        </div>
        <AffiliateCommissionTable
          affiliateId={detail.id}
          initialRows={initialCommissions.rows}
          initialTotal={initialCommissions.total}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-primary">Payouts</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {initialPayouts.total}
          </span>
        </div>
        <AffiliatePayoutTable
          affiliateId={detail.id}
          initialRows={initialPayouts.rows}
          initialTotal={initialPayouts.total}
        />
      </div>

      <AffiliateFraudPanel
        affiliateId={detail.id}
        initialSignals={fraudSignals}
        initialSummary={fraudSummary}
        initialRelatedAccounts={relatedAccounts}
      />
    </div>
  );
}
