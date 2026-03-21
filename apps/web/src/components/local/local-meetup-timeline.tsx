import { Check } from 'lucide-react';
import { cn } from '@twicely/utils/cn';

type LocalTransactionStatus =
  | 'SCHEDULED'
  | 'SELLER_CHECKED_IN'
  | 'BUYER_CHECKED_IN'
  | 'BOTH_CHECKED_IN'
  | 'ADJUSTMENT_PENDING'
  | 'RESCHEDULE_PENDING'
  | 'RECEIPT_CONFIRMED'
  | 'COMPLETED'
  | 'CANCELED'
  | 'NO_SHOW'
  | 'DISPUTED';

interface TimelineStep {
  label: string;
  status: LocalTransactionStatus;
}

const TIMELINE_STEPS: TimelineStep[] = [
  { label: 'Meetup scheduled',     status: 'SCHEDULED'           },
  { label: 'Seller checked in',    status: 'SELLER_CHECKED_IN'   },
  { label: 'Buyer checked in',     status: 'BUYER_CHECKED_IN'    },
  { label: 'Both checked in',      status: 'BOTH_CHECKED_IN'     },
  { label: 'Receipt confirmed',    status: 'RECEIPT_CONFIRMED'   },
  { label: 'Completed',            status: 'COMPLETED'           },
];

// Ordinal position for comparison
const STATUS_ORDER: Record<LocalTransactionStatus, number> = {
  SCHEDULED: 0,
  SELLER_CHECKED_IN: 1,
  BUYER_CHECKED_IN: 1,   // parallel with seller check-in
  BOTH_CHECKED_IN: 2,
  ADJUSTMENT_PENDING: 2,    // same level as BOTH_CHECKED_IN
  RESCHEDULE_PENDING: 0,    // treat as SCHEDULED level (time changing)
  RECEIPT_CONFIRMED: 3,
  COMPLETED: 4,
  CANCELED: -1,
  NO_SHOW: -1,
  DISPUTED: -1,
};

interface LocalMeetupTimelineProps {
  currentStatus: LocalTransactionStatus;
}

/**
 * Vertical timeline showing meetup progression:
 * Scheduled -> Checked In -> Both Checked In -> Receipt Confirmed -> Completed
 */
export function LocalMeetupTimeline({ currentStatus }: LocalMeetupTimelineProps) {
  const currentOrder = STATUS_ORDER[currentStatus] ?? -1;

  const isTerminalBad =
    currentStatus === 'CANCELED' ||
    currentStatus === 'NO_SHOW' ||
    currentStatus === 'DISPUTED';

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Meetup Progress
      </p>

      {isTerminalBad && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 mb-3">
          <p className="text-sm font-medium text-destructive capitalize">
            {currentStatus.toLowerCase().replace('_', ' ')}
          </p>
        </div>
      )}

      <ol className="relative border-l border-muted ml-3 space-y-4">
        {TIMELINE_STEPS.map((step) => {
          const stepOrder = STATUS_ORDER[step.status];
          const isDone = currentOrder > stepOrder;
          const isCurrent =
            currentStatus === step.status ||
            // For SELLER_CHECKED_IN and BUYER_CHECKED_IN, mark both as active
            (currentStatus === 'SELLER_CHECKED_IN' && step.status === 'SELLER_CHECKED_IN') ||
            (currentStatus === 'BUYER_CHECKED_IN' && step.status === 'BUYER_CHECKED_IN');

          return (
            <li key={step.status} className="ml-4">
              <span
                className={cn(
                  'absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full ring-2',
                  isDone
                    ? 'bg-green-500 ring-green-200'
                    : isCurrent
                    ? 'bg-primary ring-primary/30'
                    : 'bg-muted ring-muted'
                )}
              >
                {isDone && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </span>
              <p
                className={cn(
                  'text-sm leading-tight',
                  isDone
                    ? 'text-muted-foreground line-through'
                    : isCurrent
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
