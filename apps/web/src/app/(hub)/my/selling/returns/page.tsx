import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import { db } from '@twicely/db';
import { returnRequest, order, user } from '@twicely/db/schema';
import { eq, desc } from 'drizzle-orm';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { Clock, CheckCircle, XCircle, AlertTriangle, Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_CONFIG = {
  PENDING_SELLER: {
    label: 'Action Required',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
  },
  APPROVED: {
    label: 'Approved',
    color: 'bg-blue-100 text-blue-800',
    icon: CheckCircle,
  },
  DECLINED: {
    label: 'Declined',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
  SHIPPED: {
    label: 'Return Shipped',
    color: 'bg-purple-100 text-purple-800',
    icon: Package,
  },
  DELIVERED: {
    label: 'Return Received',
    color: 'bg-indigo-100 text-indigo-800',
    icon: Package,
  },
  REFUND_ISSUED: {
    label: 'Refunded',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  CLOSED: {
    label: 'Closed',
    color: 'bg-gray-100 text-gray-800',
    icon: XCircle,
  },
  ESCALATED: {
    label: 'Escalated',
    color: 'bg-orange-100 text-orange-800',
    icon: AlertTriangle,
  },
} as const;

const REASON_LABELS: Record<string, string> = {
  INAD: 'Not as described',
  DAMAGED: 'Arrived damaged',
  WRONG_ITEM: 'Wrong item',
  COUNTERFEIT: 'Counterfeit',
  REMORSE: 'Changed mind',
  INR: 'Not received',
};

export default async function SellerReturnsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Get all returns for orders where user is the seller
  const returns = await db
    .select({
      id: returnRequest.id,
      status: returnRequest.status,
      reason: returnRequest.reason,
      description: returnRequest.description,
      createdAt: returnRequest.createdAt,
      sellerResponseDueAt: returnRequest.sellerResponseDueAt,
      orderNumber: order.orderNumber,
      orderId: order.id,
      orderTotalCents: order.totalCents,
      buyerName: user.name,
    })
    .from(returnRequest)
    .innerJoin(order, eq(returnRequest.orderId, order.id))
    .innerJoin(user, eq(returnRequest.buyerId, user.id))
    .where(eq(order.sellerId, session.user.id))
    .orderBy(desc(returnRequest.createdAt));

  const pendingReturns = returns.filter(r => r.status === 'PENDING_SELLER');
  const otherReturns = returns.filter(r => r.status !== 'PENDING_SELLER');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Return Requests</h1>

      {returns.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-8 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">No return requests</h2>
          <p className="text-gray-500">You don&apos;t have any return requests yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending returns requiring action */}
          {pendingReturns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                Action Required ({pendingReturns.length})
              </h2>
              <div className="space-y-3">
                {pendingReturns.map((ret) => {
                  const status = STATUS_CONFIG[ret.status as keyof typeof STATUS_CONFIG];
                  const StatusIcon = status?.icon ?? Clock;
                  const isOverdue = ret.sellerResponseDueAt && new Date(ret.sellerResponseDueAt) < new Date();

                  return (
                    <Link
                      key={ret.id}
                      href={`/my/selling/returns/${ret.id}`}
                      className="block rounded-lg border bg-white p-4 hover:border-primary transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">Order #{ret.orderNumber}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status?.color ?? 'bg-gray-100'}`}>
                              <StatusIcon className="h-3 w-3" />
                              {status?.label ?? ret.status}
                            </span>
                            {isOverdue && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Overdue
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mb-1">
                            {ret.buyerName} · {REASON_LABELS[ret.reason] ?? ret.reason}
                          </p>
                          <p className="text-sm text-gray-600 line-clamp-1">{ret.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-medium">{formatPrice(ret.orderTotalCents)}</p>
                          <p className="text-xs text-gray-500">{formatDate(ret.createdAt)}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other returns */}
          {otherReturns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {pendingReturns.length > 0 ? 'Other Returns' : 'All Returns'}
              </h2>
              <div className="space-y-3">
                {otherReturns.map((ret) => {
                  const status = STATUS_CONFIG[ret.status as keyof typeof STATUS_CONFIG];
                  const StatusIcon = status?.icon ?? Clock;

                  return (
                    <Link
                      key={ret.id}
                      href={`/my/selling/returns/${ret.id}`}
                      className="block rounded-lg border bg-white p-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">Order #{ret.orderNumber}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status?.color ?? 'bg-gray-100'}`}>
                              <StatusIcon className="h-3 w-3" />
                              {status?.label ?? ret.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {ret.buyerName} · {REASON_LABELS[ret.reason] ?? ret.reason}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-medium">{formatPrice(ret.orderTotalCents)}</p>
                          <p className="text-xs text-gray-500">{formatDate(ret.createdAt)}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
