import { Badge } from '@twicely/ui/badge';

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELED' | 'COUNTERED' | 'WITHDRAWN';

const statusConfig: Record<OfferStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-yellow-500 hover:bg-yellow-500 text-white' },
  ACCEPTED: { label: 'Accepted', className: 'bg-green-500 hover:bg-green-500 text-white' },
  DECLINED: { label: 'Declined', className: 'bg-red-500 hover:bg-red-500 text-white' },
  EXPIRED: { label: 'Expired', className: 'bg-gray-400 hover:bg-gray-400 text-white' },
  CANCELED: { label: 'Cancelled', className: 'bg-gray-400 hover:bg-gray-400 text-white' },
  COUNTERED: { label: 'Countered', className: 'bg-blue-500 hover:bg-blue-500 text-white' },
  WITHDRAWN: { label: 'Withdrawn', className: 'bg-gray-400 hover:bg-gray-400 text-white' },
};

interface OfferStatusBadgeProps {
  status: string;
}

export function OfferStatusBadge({ status }: OfferStatusBadgeProps) {
  const config = statusConfig[status as OfferStatus] ?? {
    label: status,
    className: 'bg-gray-400 hover:bg-gray-400 text-white',
  };

  return <Badge className={config.className}>{config.label}</Badge>;
}
