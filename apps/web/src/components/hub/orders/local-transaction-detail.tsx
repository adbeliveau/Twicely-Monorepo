import type { LocalTransactionWithLocation } from '@/lib/queries/local-transaction';
import { MapPin, CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';

interface LocalTransactionDetailProps {
  localTx: LocalTransactionWithLocation;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  SELLER_CHECKED_IN: 'Seller Checked In',
  BUYER_CHECKED_IN: 'Buyer Checked In',
  BOTH_CHECKED_IN: 'Both Checked In',
  RECEIPT_CONFIRMED: 'Receipt Confirmed',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-Show',
  CANCELED: 'Cancelled',
  ADJUSTMENT_PENDING: 'Adjustment Pending',
  RESCHEDULE_PENDING: 'Reschedule Pending',
  DISPUTED: 'Disputed',
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const isCompleted = status === 'COMPLETED' || status === 'RECEIPT_CONFIRMED';
  const isNoShow = status === 'NO_SHOW';
  const isCancelled = status === 'CANCELED';

  const cls = isCompleted
    ? 'bg-green-100 text-green-700'
    : isNoShow || isCancelled
      ? 'bg-red-100 text-red-700'
      : 'bg-blue-100 text-blue-700';

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function LocalTransactionDetail({ localTx: tx }: LocalTransactionDetailProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-gray-400" />
        Local Pickup Transaction
      </h3>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Status</span>
          <StatusBadge status={tx.status} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-500">Scheduled</span>
          <span className="font-medium">{formatDate(tx.scheduledAt)}</span>
        </div>

        {tx.meetupLocation && (
          <div className="rounded-md bg-gray-50 p-3">
            <p className="font-medium text-gray-800">{tx.meetupLocation.name}</p>
            <p className="text-gray-500">
              {tx.meetupLocation.address}, {tx.meetupLocation.city}, {tx.meetupLocation.state} {tx.meetupLocation.zip}
            </p>
            <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {tx.meetupLocation.type}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 mb-1">Seller Check-In</p>
            <div className="flex items-center gap-1.5">
              {tx.sellerCheckedIn
                ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                : <XCircle className="h-3.5 w-3.5 text-gray-300" />}
              <span className="text-gray-600">
                {tx.sellerCheckedIn ? formatDate(tx.sellerCheckedInAt) : 'Not checked in'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 mb-1">Buyer Check-In</p>
            <div className="flex items-center gap-1.5">
              {tx.buyerCheckedIn
                ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                : <XCircle className="h-3.5 w-3.5 text-gray-300" />}
              <span className="text-gray-600">
                {tx.buyerCheckedIn ? formatDate(tx.buyerCheckedInAt) : 'Not checked in'}
              </span>
            </div>
          </div>
        </div>

        {tx.confirmationMode && (
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-gray-500">Confirmation Mode</span>
            <span className="font-medium capitalize">{tx.confirmationMode.replace(/_/g, ' ')}</span>
          </div>
        )}

        {tx.confirmedAt && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Confirmed At</span>
            <span className="font-medium">{formatDate(tx.confirmedAt)}</span>
          </div>
        )}

        {tx.noShowParty && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 border-t border-gray-100 mt-1">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-700">No-Show: {tx.noShowParty}</p>
              <p className="text-red-600 text-xs">
                A reliability mark has been recorded. Repeated no-shows may affect seller standing.
              </p>
            </div>
          </div>
        )}

        {tx.safetyAlertSent && (
          <div className="flex items-center gap-2 rounded-md bg-orange-50 p-3">
            <Clock className="h-4 w-4 text-orange-500" />
            <p className="text-orange-700 text-xs font-medium">
              Safety alert sent {tx.safetyAlertAt ? `on ${formatDate(tx.safetyAlertAt)}` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
