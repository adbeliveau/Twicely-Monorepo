import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { dispute, order, user } from '@twicely/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_CONFIG = {
  OPEN: { label: 'Open', color: 'bg-yellow-100 text-yellow-800', priority: 1 },
  UNDER_REVIEW: { label: 'Under Review', color: 'bg-blue-100 text-blue-800', priority: 2 },
  RESOLVED_BUYER: { label: 'Resolved (Buyer)', color: 'bg-green-100 text-green-800', priority: 3 },
  RESOLVED_SELLER: { label: 'Resolved (Seller)', color: 'bg-gray-100 text-gray-800', priority: 4 },
  RESOLVED_PARTIAL: { label: 'Resolved (Partial)', color: 'bg-teal-100 text-teal-800', priority: 5 },
  APPEALED: { label: 'Appealed', color: 'bg-purple-100 text-purple-800', priority: 6 },
  APPEAL_RESOLVED: { label: 'Appeal Resolved', color: 'bg-indigo-100 text-indigo-800', priority: 7 },
  CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-800', priority: 8 },
} as const;

const CLAIM_LABELS: Record<string, string> = {
  INR: 'Not Received',
  INAD: 'Not As Described',
  DAMAGED: 'Damaged',
  COUNTERFEIT: 'Counterfeit',
  REMORSE: 'Remorse',
};

export default async function AdminDisputesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Dispute')) {
    return <p className="text-red-600">Access denied</p>;
  }

  // Get all disputes
  const disputes = await db
    .select({
      id: dispute.id,
      status: dispute.status,
      claimType: dispute.claimType,
      description: dispute.description,
      createdAt: dispute.createdAt,
      deadlineAt: dispute.deadlineAt,
      resolvedByStaffId: dispute.resolvedByStaffId,
      orderNumber: order.orderNumber,
      orderTotalCents: order.totalCents,
      buyerId: dispute.buyerId,
      sellerId: dispute.sellerId,
    })
    .from(dispute)
    .innerJoin(order, eq(dispute.orderId, order.id))
    .orderBy(desc(dispute.createdAt));

  // Get buyer/seller names
  const userIds = [...new Set(disputes.flatMap((d) => [d.buyerId, d.sellerId]))];
  const users = userIds.length > 0
    ? await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, userIds))
    : [];

  const userMap = new Map(users.map((u) => [u.id, u.name]));

  // Split into categories
  const openDisputes = disputes.filter((d) => ['OPEN', 'UNDER_REVIEW', 'APPEALED'].includes(d.status));
  const resolvedDisputes = disputes.filter((d) => ['RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_PARTIAL', 'APPEAL_RESOLVED', 'CLOSED'].includes(d.status));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Disputes & Claims</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage buyer protection claims and disputes
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{openDisputes.length}</div>
            <div className="text-gray-500">Open</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{resolvedDisputes.length}</div>
            <div className="text-gray-500">Resolved</div>
          </div>
        </div>
      </div>

      {disputes.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-8 text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-primary mb-2">No disputes</h2>
          <p className="text-gray-500">There are no disputes or claims to review.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Open disputes */}
          {openDisputes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Open Cases ({openDisputes.length})
              </h2>
              <div className="rounded-lg border bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-primary/5 border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Order</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Parties</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Deadline</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {openDisputes.map((d) => {
                      const status = STATUS_CONFIG[d.status as keyof typeof STATUS_CONFIG];
                      const isOverdue = d.deadlineAt && new Date(d.deadlineAt) < new Date();

                      return (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="font-medium">#{d.orderNumber}</div>
                            <div className="text-xs text-gray-500">{formatDate(d.createdAt)}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <span>{CLAIM_LABELS[d.claimType] ?? d.claimType}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs">
                              <div>Buyer: {userMap.get(d.buyerId) ?? 'Unknown'}</div>
                              <div className="text-gray-500">Seller: {userMap.get(d.sellerId) ?? 'Unknown'}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status?.color ?? 'bg-gray-100'}`}>
                              {status?.label ?? d.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {formatPrice(d.orderTotalCents)}
                          </td>
                          <td className="py-3 px-4">
                            {d.deadlineAt ? (
                              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                {isOverdue ? 'Overdue' : formatDate(d.deadlineAt)}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              href={`/mod/disputes/${d.id}`}
                              className="text-primary hover:text-primary/80 font-medium"
                            >
                              Review
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resolved disputes */}
          {resolvedDisputes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Resolved ({resolvedDisputes.length})
              </h2>
              <div className="rounded-lg border bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-primary/5 border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Order</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Resolution</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {resolvedDisputes.slice(0, 10).map((d) => {
                      const status = STATUS_CONFIG[d.status as keyof typeof STATUS_CONFIG];

                      return (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="font-medium">#{d.orderNumber}</div>
                            <div className="text-xs text-gray-500">{formatDate(d.createdAt)}</div>
                          </td>
                          <td className="py-3 px-4">
                            {CLAIM_LABELS[d.claimType] ?? d.claimType}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status?.color ?? 'bg-gray-100'}`}>
                              {status?.label ?? d.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {formatPrice(d.orderTotalCents)}
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              href={`/mod/disputes/${d.id}`}
                              className="text-primary hover:text-primary/80 font-medium"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
