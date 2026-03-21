'use client';

import { Link } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@twicely/ui/button';

interface AffiliateLinkButtonProps {
  listingSlug: string;
  affiliateCode: string;
  commissionBps: number;
}

export function AffiliateLinkButton({
  listingSlug,
  affiliateCode,
  commissionBps,
}: AffiliateLinkButtonProps) {
  const commissionPercent = (commissionBps / 100).toFixed(1);

  function handleCopy() {
    const url = `https://twicely.co/i/${listingSlug}?ref=${affiliateCode}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Affiliate link copied!', {
        description: `Share this to earn ${commissionPercent}% commission`,
      });
    }).catch(() => {
      toast.error('Could not copy', {
        description: 'Please copy the link manually',
      });
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-1.5"
    >
      <Link className="h-4 w-4" />
      Get Affiliate Link
    </Button>
  );
}
