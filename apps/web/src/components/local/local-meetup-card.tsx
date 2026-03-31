'use client';

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Calendar, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { QrCodeDisplay } from './qr-code-display';
import { ManualCodeEntry } from './manual-code-entry';
import { LocalMeetupTimeline } from './local-meetup-timeline';
import { checkInToMeetupAction } from '@/lib/actions/local-transaction';
import type { LocalTransactionWithLocation } from '@/lib/queries/local-transaction';
import { haversineDistanceMiles } from '@twicely/utils/geo';
import { PriceAdjustmentForm } from './price-adjustment-form';
import { PriceAdjustmentResponse } from './price-adjustment-response';
import { MeetupTimePicker } from './meetup-time-picker';
import { RescheduleFlow } from './reschedule-flow';
import { CancelMeetupButton } from './cancel-meetup-button';
import { DayOfConfirmation } from './day-of-confirmation';
import { STATUS_LABELS, STATUS_VARIANT } from './local-meetup-status';
import { MeetupPhotoCapture } from './meetup-photo-capture';
import { ReliabilityBadge } from './reliability-badge';
import type { CounterpartyReliability } from './reliability-badge';

const MeetupMap = dynamic(
  () => import('./meetup-map').then((m) => m.MeetupMap),
  { ssr: false }
);

interface LocalMeetupCardProps {
  transaction: LocalTransactionWithLocation;
  role: 'BUYER' | 'SELLER';
  currentUserId: string;
  otherPartyName: string;
  buyerLat?: number;
  buyerLng?: number;
  sellerLat?: number;
  sellerLng?: number;
  originalPriceCents?: number;
  maxDiscountPercent?: number;
  rescheduleMaxCount?: number;
  dayOfConfirmationWindowHours?: number;
  counterpartyReliability?: CounterpartyReliability | null;
}

const FMT_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function formatScheduledAt(date: Date): string { return FMT_DATE.format(new Date(date)); }

export function LocalMeetupCard({
  transaction: tx,
  role,
  currentUserId,
  otherPartyName,
  buyerLat,
  buyerLng,
  sellerLat,
  sellerLng,
  originalPriceCents,
  maxDiscountPercent = 33,
  rescheduleMaxCount,
  dayOfConfirmationWindowHours,
  counterpartyReliability,
}: LocalMeetupCardProps) {
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasCheckedIn =
    role === 'BUYER' ? tx.buyerCheckedIn : tx.sellerCheckedIn;

  // Check-in is locked until scheduling is confirmed (G2.9)
  const schedulingConfirmed = tx.scheduledAtConfirmedAt !== null;
  const canCheckIn =
    schedulingConfirmed &&
    !hasCheckedIn &&
    tx.status !== 'RESCHEDULE_PENDING' &&
    ['SCHEDULED', 'SELLER_CHECKED_IN', 'BUYER_CHECKED_IN'].includes(tx.status);

  const showRescheduleFlow =
    schedulingConfirmed &&
    ['SCHEDULED', 'SELLER_CHECKED_IN', 'BUYER_CHECKED_IN', 'RESCHEDULE_PENDING'].includes(tx.status);

  const isAdjustmentPending = tx.status === 'ADJUSTMENT_PENDING';

  const showQrCode = role === 'SELLER' && tx.status !== 'COMPLETED' && !isAdjustmentPending;
  const showManualEntry = role === 'BUYER' && ['BOTH_CHECKED_IN', 'RECEIPT_CONFIRMED'].includes(tx.status) && !isAdjustmentPending;

  const showAdjustmentForm = role === 'SELLER' && tx.status === 'BOTH_CHECKED_IN' && tx.adjustmentInitiatedAt === null && originalPriceCents !== undefined;
  const showAdjustmentResponse = role === 'BUYER' && isAdjustmentPending && tx.adjustedPriceCents !== null && tx.adjustedPriceCents !== undefined && tx.adjustmentReason !== null && originalPriceCents !== undefined;

  const showSellerWaiting = role === 'SELLER' && isAdjustmentPending;

  const showDayOfConfirmation = schedulingConfirmed && tx.scheduledAt !== null && ['SCHEDULED', 'SELLER_CHECKED_IN', 'BUYER_CHECKED_IN'].includes(tx.status);

  function handleCheckIn() {
    setCheckInError(null);
    startTransition(async () => {
      const result = await checkInToMeetupAction({ localTransactionId: tx.id });
      if (!result.success) setCheckInError(result.error ?? 'Failed to check in');
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Local Pickup
          </CardTitle>
          <Badge variant={STATUS_VARIANT[tx.status] ?? 'secondary'}>
            {STATUS_LABELS[tx.status] ?? tx.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Counterparty reliability — G2.8 */}
        {counterpartyReliability && (
          <ReliabilityBadge reliability={counterpartyReliability} viewerRole={role} />
        )}

        {/* Scheduled date/time — only shown when scheduledAt is set */}
        {tx.scheduledAt !== null && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{formatScheduledAt(tx.scheduledAt)}</span>
          </div>
        )}

        {/* Meetup map — renders only when coordinates are available */}
        {buyerLat !== undefined &&
          buyerLng !== undefined &&
          sellerLat !== undefined &&
          sellerLng !== undefined && (
            <MeetupMap
              buyerLat={buyerLat}
              buyerLng={buyerLng}
              sellerLat={sellerLat}
              sellerLng={sellerLng}
              safeSpot={
                tx.meetupLocation
                  ? {
                      lat: tx.meetupLocation.latitude,
                      lng: tx.meetupLocation.longitude,
                      name: tx.meetupLocation.name,
                      verified: tx.meetupLocation.verifiedSafe,
                    }
                  : null
              }
              distanceMiles={haversineDistanceMiles(buyerLat, buyerLng, sellerLat, sellerLng)}
            />
          )}

        {/* Safe meetup location */}
        {tx.meetupLocation && (
          <div className="rounded-md bg-muted/50 border p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm font-medium">{tx.meetupLocation.name}</span>
              {tx.meetupLocation.verifiedSafe && (
                <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                  Safe spot
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {tx.meetupLocation.address}, {tx.meetupLocation.city}, {tx.meetupLocation.state}
            </p>
          </div>
        )}

        {/* Timeline */}
        <LocalMeetupTimeline currentStatus={tx.status} />

        {/* Condition photos — read-only after confirmation (both parties) */}
        {tx.meetupPhotoUrls.length > 0 && tx.confirmedAt !== null && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Condition photos taken at {formatScheduledAt(tx.meetupPhotosAt ?? tx.confirmedAt)}</p>
            <div className="flex gap-2 flex-wrap">{tx.meetupPhotoUrls.map((url) => ( // eslint-disable-line @next/next/no-img-element
              <a key={url} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="Condition photo" className="w-16 h-16 object-cover rounded-md border hover:opacity-90 transition-opacity" /></a>))}</div>
          </div>
        )}
        {/* Buyer: photo evidence capture before confirmation */}
        {role === 'BUYER' && (tx.status === 'BOTH_CHECKED_IN' || tx.status === 'ADJUSTMENT_PENDING') && tx.confirmedAt === null && (
          <MeetupPhotoCapture localTransactionId={tx.id} existingPhotoUrls={tx.meetupPhotoUrls} />
        )}
        {/* Seller shows QR code */}
        {showQrCode && (
          <div className="border rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Show this to the buyer</p>
            <QrCodeDisplay
              token={tx.sellerConfirmationCode}
              offlineCode={tx.sellerOfflineCode}
              role="SELLER"
            />
          </div>
        )}

        {/* Buyer: manual code entry after check-in */}
        {showManualEntry && (
          <div className="border rounded-lg p-4">
            <p className="text-sm font-medium mb-3">
              Scan the seller&apos;s QR code or enter the 6-digit code to confirm receipt
            </p>
            <ManualCodeEntry localTransactionId={tx.id} />
          </div>
        )}

        {/* Seller: propose a price adjustment when both checked in */}
        {showAdjustmentForm && (
          <PriceAdjustmentForm
            localTransactionId={tx.id}
            originalPriceCents={originalPriceCents!}
            maxDiscountPercent={maxDiscountPercent}
          />
        )}

        {/* Buyer: respond to a pending price adjustment */}
        {showAdjustmentResponse && (
          <PriceAdjustmentResponse
            localTransactionId={tx.id}
            originalPriceCents={originalPriceCents!}
            adjustedPriceCents={tx.adjustedPriceCents!}
            adjustmentReason={tx.adjustmentReason!}
          />
        )}

        {/* Seller: waiting for buyer response to adjustment */}
        {showSellerWaiting && (
          <div className="rounded-lg border bg-amber-50 border-amber-200 p-4">
            <p className="text-sm font-medium text-amber-900">
              Waiting for buyer to respond to your price adjustment
            </p>
            <p className="text-xs text-amber-700 mt-1">
              The buyer will accept or decline the adjusted price.
            </p>
          </div>
        )}

        {/* Scheduling: time picker — shown until scheduling is confirmed */}
        {!schedulingConfirmed && (
          <MeetupTimePicker
            localTransactionId={tx.id}
            proposedAt={tx.scheduledAt}
            proposedByUserId={tx.schedulingProposedBy}
            isConfirmed={schedulingConfirmed}
            role={role}
            currentUserId={currentUserId}
            otherPartyName={otherPartyName}
          />
        )}

        {/* Reschedule flow — shown after scheduling is confirmed (G2.10) */}
        {showRescheduleFlow && tx.scheduledAt !== null && (
          <RescheduleFlow
            localTransactionId={tx.id}
            scheduledAt={tx.scheduledAt}
            rescheduleProposedAt={tx.rescheduleProposedAt ?? null}
            proposedByUserId={tx.schedulingProposedBy}
            currentUserId={currentUserId}
            otherPartyName={otherPartyName}
            rescheduleCount={tx.rescheduleCount ?? 0}
            rescheduleMaxCount={rescheduleMaxCount ?? 2}
          />
        )}

        {/* Day-of confirmation — shown when within confirmation window (G2.12) */}
        {showDayOfConfirmation && (
          <DayOfConfirmation
            localTransactionId={tx.id}
            scheduledAt={tx.scheduledAt!}
            role={role}
            dayOfConfirmationSentAt={tx.dayOfConfirmationSentAt ?? null}
            dayOfConfirmationRespondedAt={tx.dayOfConfirmationRespondedAt ?? null}
            dayOfConfirmationExpired={tx.dayOfConfirmationExpired ?? false}
            windowHours={dayOfConfirmationWindowHours ?? 12}
          />
        )}

        {['SCHEDULED','SELLER_CHECKED_IN','BUYER_CHECKED_IN','RESCHEDULE_PENDING'].includes(tx.status) && <CancelMeetupButton localTransactionId={tx.id} scheduledAt={tx.scheduledAt} />}
        {canCheckIn && (
          <div className="space-y-2">
            <Button
              onClick={handleCheckIn}
              disabled={isPending}
              variant="outline"
              className="w-full"
            >
              {isPending ? 'Checking in…' : 'Check In'}
            </Button>
            {checkInError && (
              <p className="text-sm text-destructive">{checkInError}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
