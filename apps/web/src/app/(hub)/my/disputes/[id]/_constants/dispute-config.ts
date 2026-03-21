import { Clock, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatusEntry {
  label: string;
  color: string;
  icon: LucideIcon;
  description: string;
}

export const STATUS_CONFIG: Record<string, StatusEntry> = {
  OPEN: {
    label: 'Under Review',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
    description: 'Our team is reviewing your case.',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    color: 'bg-blue-100 text-blue-800',
    icon: Clock,
    description: 'An admin has been assigned and is reviewing your case.',
  },
  AWAITING_BUYER: {
    label: 'Awaiting Your Response',
    color: 'bg-purple-100 text-purple-800',
    icon: MessageSquare,
    description: 'We need additional information from you.',
  },
  AWAITING_SELLER: {
    label: 'Awaiting Seller Response',
    color: 'bg-orange-100 text-orange-800',
    icon: Clock,
    description: 'Waiting for the seller to respond.',
  },
  RESOLVED_BUYER: {
    label: 'Resolved - Refund Issued',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    description: 'This case was resolved in your favor.',
  },
  RESOLVED_SELLER: {
    label: 'Resolved - Claim Denied',
    color: 'bg-gray-100 text-gray-800',
    icon: XCircle,
    description: 'This case was not resolved in your favor.',
  },
  CLOSED: {
    label: 'Closed',
    color: 'bg-gray-100 text-gray-800',
    icon: XCircle,
    description: 'This case has been closed.',
  },
};

export const CLAIM_TYPE_LABELS: Record<string, string> = {
  INR: 'Item Not Received',
  INAD: 'Item Not As Described',
  DAMAGED: 'Item Damaged',
  COUNTERFEIT: 'Counterfeit Item',
  REMORSE: 'Buyer Remorse',
};
