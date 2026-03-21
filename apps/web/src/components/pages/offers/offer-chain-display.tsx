'use client';

import { useEffect, useState } from 'react';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { cn } from '@twicely/utils';

interface OfferChainNode {
  id: string;
  offerCents: number;
  status: string;
  createdAt: Date;
  counterByRole: string | null;
}

interface OfferChainDisplayProps {
  offerId: string;
  currentOfferId: string;
  fetchChain: (offerId: string) => Promise<OfferChainNode[]>;
}

export function OfferChainDisplay({ offerId, currentOfferId, fetchChain }: OfferChainDisplayProps) {
  const [chain, setChain] = useState<OfferChainNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchChain(offerId).then((data) => {
      if (mounted) {
        setChain(data.reverse()); // Newest first
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [offerId, fetchChain]);

  if (loading) {
    return <div className="py-4 text-sm text-muted-foreground">Loading offer history...</div>;
  }

  if (chain.length === 0) {
    return <div className="py-4 text-sm text-muted-foreground">No offer history available.</div>;
  }

  return (
    <div className="py-4">
      <h4 className="text-sm font-medium mb-3">Offer History</h4>
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-4">
          {chain.map((node, index) => {
            const isCurrent = node.id === currentOfferId;
            const role = node.counterByRole || 'BUYER';
            const isNewest = index === 0;

            return (
              <div key={node.id} className="relative">
                {/* Node dot */}
                <div
                  className={cn(
                    'absolute -left-6 top-1 h-4 w-4 rounded-full border-2 bg-background',
                    isCurrent ? 'border-primary bg-primary' : 'border-muted-foreground'
                  )}
                />

                <div className={cn('rounded-lg border p-3', isCurrent && 'border-primary bg-primary/5')}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded',
                          role === 'BUYER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        )}
                      >
                        {role === 'BUYER' ? 'Buyer' : 'Seller'}
                      </span>
                      <span className="font-semibold">{formatPrice(node.offerCents)}</span>
                      {isNewest && <span className="text-xs text-muted-foreground">(Current)</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(node.createdAt, 'relative')}</span>
                  </div>

                  {node.status !== 'PENDING' && node.status !== 'COUNTERED' && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Status: {node.status.charAt(0) + node.status.slice(1).toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface OfferChainInlineProps {
  chain: OfferChainNode[];
  currentOfferId: string;
}

export function OfferChainInline({ chain, currentOfferId }: OfferChainInlineProps) {
  if (chain.length <= 1) return null;

  const reversed = [...chain].reverse(); // Newest first

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {reversed.map((node, i) => {
        const isCurrent = node.id === currentOfferId;
        return (
          <span key={node.id} className="flex items-center gap-1">
            {i > 0 && <span className="mx-1">→</span>}
            <span className={cn(isCurrent && 'font-semibold text-foreground')}>
              {formatPrice(node.offerCents)}
            </span>
          </span>
        );
      })}
    </div>
  );
}
