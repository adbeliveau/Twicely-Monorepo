import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { returnRequest, order, user } from '@twicely/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_CONFIG = {
  PENDING_SELLER:      { label: 'Pending Seller',     color: 'bg-yellow-100 text-yellow-800' },
  APPROVED:            { label: 'Approved',            color: 'bg-green-100 text-green-800' },
  PARTIAL_OFFERED:     { label: 'Partial Offered',     color: 'bg-blue-100 text-blue-800' },
  LABEL_GENERATED:     { label: 'Label Generated',     color: 'bg-indigo-100 text-indigo-800' },
  SHIPPED:             { label: 'Shipped',             color: 'bg-purple-100 text-purple-800' },
  CONDITION_DISPUTE:   { label: 'Condition Dispute',   color: 'bg-orange-100 text-orange-800' },
  ESCALATED:           { label: 'Escalated',           color: 'bg-red-100 text-red-800' },
  DECLINED:            { label: 'Declined',            color: 'bg-gray-100 text-gray-800' },
  BUYER_ACCEPTS:       { label: 'Buyer Accepted',      color: 'bg-teal-100 text-teal-800' },
  BUYER_ACCEPTS_PARTIAL: { label: 'Accepted Partial',  color: 'bg-teal-100 text-teal-800' },
  BUYER_DECLINES_PARTIAL: { label: 'Declined Partial', color: 'bg-gray-100 text-gray-800' },
  DELIVERED:           { label: 'Delivered',           color: 'bg-green-100 text-green-800' },
  REFUND_ISSUED:       { label: 'Refund Issued',       color: 'bg-green-100 text-green-800' },
  CLOSED:              { label: 'Closed',              color: 'bg-gray-100 text-gray-800' },
} as const;

const REASON_LABELS: Record<string, string> = {
  INAD:        'Item Not As Described',
  DAMAGED:     'Damaged',
  INR:         'Not Received',
  COUNTERFEIT: 'Counterfeit',
  REMORSE:     'Changed Mind',
  WRONG_ITEM:  'Wrong Item',
};

const FAULT_LABELS: Record<string, string> = {
  SELLER:   'Seller',
  BUYER:    'Buyer',
  CARRIER:  'Carrier',
  PLATFORM: 'Platform',
};

const ACTIVE_STATUSES = [
  'PENDING_SELLER', 'APPROVED', 'PARTIAL_OFFERED',
  'LABEL_GENERATED', 'SHIPPED', 'CONDITION_DISPUTE', 'ESCALATED',
] as const;

const TERMINAL_STATUSES = [
  'DECLINED', 'BUYER_ACCEPTS', 'BUYER_ACCEPTS_PARTIAL',
  'BUYER_DECLINES_PARTIAL', 'DELIVERED', 'REFUND_ISSUED', 'CLOSED',
] as const;

export default async function AdminReturnsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Return')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const returns = await db
    .select({
      id:                   returnRequest.id,
      status:               returnRequest.status,
      reason:               returnRequest.reason,
      fault:                returnRequest.fault,
      refundAmountCents:    returnRequest.refundAmountCents,
      sellerResponseDueAt:  returnRequest.sellerResponseDueAt,
      escalatedAt:          returnRequest.escalatedAt,
      createdAt:            returnRequest.createdAt,
      orderNumber:          order.orderNumber,
      buyerId:              returnRequest.buyerId,
      sellerId:             returnRequest.sellerId,
    })
    .from(returnRequest)
    .innerJoin(order, eq(returnRequest.orderId, order.id))
    .orderBy(desc(returnRequest.createdAt));

  const userIds = [...new Set(returns.flatMap((r) => [r.buyerId, r.sellerId]))];
  const users = userIds.length > 0
    ? await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, userIds))
    : [];

  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const activeReturns = returns.filter((r) =>
    (ACTIVE_STATUSES as readonly string[]).includes(r.status)
  );
  const resolvedReturns = returns
    .filter((r) => (TERMINAL_STATUSES as readonly string[]).includes(r.status))
    .slice(0, 20);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Returns</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage return requests and refund approvals
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{activeReturns.length}</div>
            <div className="text-gray-500">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{resolvedReturns.length}</div>
            <div className="text-gray-500">Resolved</div>
          </div>
        </div>
      </div>

      {returns.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-8 text-center">
          <RotateCcw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-primary mb-2">No returns</h2>
          <p className="text-gray-500">There are no return requests to review.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeReturns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Active Returns ({activeReturns.length})
              </h2>
              <div className="rounded-lg border bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-primary/5 border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Order</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Reason</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Fault</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Parties</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Refund</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Seller Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeReturns.map((r) => {
                      const status = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG];
                      const isOverdue =
                        r.sellerResponseDueAt !== null &&
                        r.sellerResponseDueAt !== undefined &&
                        new Date(r.sellerResponseDueAt) < new Date();

                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="font-medium">#{r.orderNumber}</div>
                            <div className="text-xs text-gray-500">{formatDate(r.createdAt)}</div>
                          </td>
                          <td className="py-3 px-4">
                            {REASON_LABELS[r.reason] ?? r.reason}
                          </td>
                          <td className="py-3 px-4">
                            {r.fault ? (FAULT_LABELS[r.fault] ?? r.fault) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs">
                              <div>Buyer: {userMap.get(r.buyerId) ?? 'Unknown'}</div>
                              <div className="text-gray-500">Seller: {userMap.get(r.sellerId) ?? 'Unknown'}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status?.color ?? 'bg-gray-100'}`}>
                              {status?.label ?? r.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {r.refundAmountCents !== null && r.refundAmountCents !== undefined
                              ? formatPrice(r.refundAmountCents)
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            {r.sellerResponseDueAt ? (
                              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                {isOverdue ? 'Overdue' : formatDate(r.sellerResponseDueAt)}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {resolvedReturns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Resolved ({resolvedReturns.length})
              </h2>
              <div className="rounded-lg border bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-primary/5 border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Order</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Reason</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Fault</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Parties</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-primary/70">Refund</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {resolvedReturns.map((r) => {
                      const status = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG];

                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="font-medium">#{r.orderNumber}</div>
                            <div className="text-xs text-gray-500">{formatDate(r.createdAt)}</div>
                          </td>
                          <td className="py-3 px-4">
                            {REASON_LABELS[r.reason] ?? r.reason}
                          </td>
                          <td className="py-3 px-4">
                            {r.fault ? (FAULT_LABELS[r.fault] ?? r.fault) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs">
                              <div>Buyer: {userMap.get(r.buyerId) ?? 'Unknown'}</div>
                              <div className="text-gray-500">Seller: {userMap.get(r.sellerId) ?? 'Unknown'}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status?.color ?? 'bg-gray-100'}`}>
                              {status?.label ?? r.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {r.refundAmountCents !== null && r.refundAmountCents !== undefined
                              ? formatPrice(r.refundAmountCents)
                              : <span className="text-gray-400">—</span>}
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
