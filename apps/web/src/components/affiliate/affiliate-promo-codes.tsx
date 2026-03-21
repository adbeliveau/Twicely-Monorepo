'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { Tag } from 'lucide-react';
import { formatCentsToDollars } from '@twicely/finance/format';
import { CreatePromoCodeDialog } from './create-promo-code-dialog';
import { EditPromoCodeDialog } from './edit-promo-code-dialog';
import type { PromoCodeRow } from '@/lib/queries/promo-codes';

interface AffiliatePromoCodesProps {
  promoCodes: PromoCodeRow[];
  isActive: boolean;
  affiliateId: string;
}

function formatDiscount(row: PromoCodeRow): string {
  if (row.discountType === 'PERCENTAGE') {
    return `${row.discountValue / 100}% off`;
  }
  return `${formatCentsToDollars(row.discountValue)} off`;
}

export function AffiliatePromoCodes({
  promoCodes,
  isActive,
  affiliateId,
}: AffiliatePromoCodesProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PromoCodeRow | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-5 w-5" />
            Promo Codes
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={!isActive}
            title={!isActive ? 'Your affiliate account must be active to create codes' : undefined}
          >
            Create Code
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {promoCodes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Create a promo code to share with your audience
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Code</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Discount</th>
                  <th className="pb-2 pr-4 font-medium">Duration</th>
                  <th className="pb-2 pr-4 font-medium">Uses</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {promoCodes.map((pc) => (
                  <tr key={pc.id} className="hover:bg-muted/30">
                    <td className="py-3 pr-4 font-mono font-medium">{pc.code}</td>
                    <td className="py-3 pr-4 capitalize">{pc.discountType.toLowerCase()}</td>
                    <td className="py-3 pr-4">{formatDiscount(pc)}</td>
                    <td className="py-3 pr-4">{pc.durationMonths} mo</td>
                    <td className="py-3 pr-4">
                      {pc.usageLimit ? `${pc.usageCount}/${pc.usageLimit}` : pc.usageCount}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={pc.isActive ? 'default' : 'secondary'}>
                        {pc.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditTarget(pc)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <CreatePromoCodeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        affiliateId={affiliateId}
      />

      {editTarget && (
        <EditPromoCodeDialog
          open={!!editTarget}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
          promoCode={editTarget}
        />
      )}
    </Card>
  );
}
