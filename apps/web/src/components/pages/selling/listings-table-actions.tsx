'use client';

import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@twicely/ui/dropdown-menu';
import { MoreHorizontal, Pause, Play, XCircle, Pencil, Trash2 } from 'lucide-react';
import type { SellerListingRow, ListingStatus } from '@/lib/queries/seller-listings';

interface RowActionsProps {
  item: SellerListingRow;
  onStatusChange: (id: string, status: ListingStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled: boolean;
}

export function RowActions({ item, onStatusChange, onDelete, disabled }: RowActionsProps) {
  const canPause = item.status === 'ACTIVE';
  const canResume = item.status === 'PAUSED';
  const canActivate = item.status === 'DRAFT' || item.status === 'ENDED';
  const canEnd = item.status === 'ACTIVE' || item.status === 'PAUSED';
  const canHardDelete = item.status === 'DRAFT' || item.status === 'ENDED';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/my/selling/listings/${item.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canPause && (
          <DropdownMenuItem onClick={() => onStatusChange(item.id, 'PAUSED')}>
            <Pause className="mr-2 h-4 w-4" />
            Pause
          </DropdownMenuItem>
        )}
        {canResume && (
          <DropdownMenuItem onClick={() => onStatusChange(item.id, 'ACTIVE')}>
            <Play className="mr-2 h-4 w-4" />
            Resume
          </DropdownMenuItem>
        )}
        {canActivate && (
          <DropdownMenuItem onClick={() => onStatusChange(item.id, 'ACTIVE')}>
            <Play className="mr-2 h-4 w-4" />
            Activate
          </DropdownMenuItem>
        )}
        {canEnd && (
          <DropdownMenuItem onClick={() => onStatusChange(item.id, 'ENDED')}>
            <XCircle className="mr-2 h-4 w-4" />
            End Listing
          </DropdownMenuItem>
        )}
        {canHardDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
