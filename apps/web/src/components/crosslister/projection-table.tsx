'use client';

/**
 * ProjectionTable — crosslisted items with status, actions, and external links.
 * Source: F3 install prompt §3.8
 */

import { useState, useTransition } from 'react';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { ExternalLink } from 'lucide-react';
import { delistFromChannel } from '@/lib/actions/crosslister-publish';
import { CHANNEL_REGISTRY } from '@twicely/crosslister/channel-registry';
import { ProjectionOverridesDialog } from './projection-overrides-dialog';
import type { ChannelProjection } from '@twicely/crosslister/db-types';
import type { ExternalChannel } from '@twicely/crosslister/types';

type ProjectionRow = ChannelProjection & { listingTitle: string | null };

interface ProjectionTableProps {
  projections: ProjectionRow[];
  onRefresh: () => void;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE': return 'default';
    case 'PUBLISHING': return 'secondary';
    case 'ERROR': return 'destructive';
    case 'DELISTED': return 'outline';
    default: return 'secondary';
  }
}

function RowActions({ projection, onRefresh }: { projection: ProjectionRow; onRefresh: () => void }) {
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelist() {
    setError(null);
    startTransition(async () => {
      const result = await delistFromChannel({ projectionId: projection.id });
      if (!result.success) {
        setError(result.error ?? 'Delist failed');
        return;
      }
      onRefresh();
    });
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {projection.status === 'ACTIVE' && (
        <>
          <Button size="sm" variant="ghost" onClick={() => setOverridesOpen(true)}>
            Edit overrides
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelist} disabled={isPending}>
            {isPending ? 'Delisting...' : 'Delist'}
          </Button>
        </>
      )}
      {projection.status === 'ERROR' && (
        <span className="text-xs text-destructive">{projection.lastPublishError ?? 'Error'}</span>
      )}
      {error ? <span className="text-xs text-destructive ml-1">{error}</span> : null}

      <ProjectionOverridesDialog
        projection={projection}
        canonicalTitle={projection.listingTitle}
        canonicalDescription={null}
        canonicalPriceCents={null}
        open={overridesOpen}
        onOpenChange={setOverridesOpen}
        onSaved={onRefresh}
      />
    </div>
  );
}

export function ProjectionTable({ projections, onRefresh }: ProjectionTableProps) {
  if (projections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No crosslisted items yet. Select listings and platforms above to get started.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-left">
            <th className="pb-2 font-medium">Listing</th>
            <th className="pb-2 font-medium">Platform</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">External URL</th>
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {projections.map((proj) => {
            const channel = proj.channel as ExternalChannel;
            const meta = CHANNEL_REGISTRY.get(channel);
            return (
              <tr key={proj.id} className="py-2">
                <td className="py-2 pr-3 max-w-[200px] truncate">{proj.listingTitle ?? '(untitled)'}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{meta?.displayName ?? channel}</td>
                <td className="py-2 pr-3">
                  <Badge variant={statusVariant(proj.status)}>{proj.status}</Badge>
                </td>
                <td className="py-2 pr-3">
                  {proj.externalUrl ? (
                    <a href={proj.externalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2">
                  <RowActions projection={proj} onRefresh={onRefresh} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
