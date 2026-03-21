import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@twicely/ui/button';

interface TierGateCTAProps {
  feature: string;
  requiredTier: string;
  currentTier: string;
}

export function TierGateCTA({ feature, requiredTier }: TierGateCTAProps) {
  const tierLabel = requiredTier.charAt(0) + requiredTier.slice(1).toLowerCase();

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-gray-50/90 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-gray-600">
        <Lock className="h-5 w-5" />
        <span className="text-sm font-medium">
          Upgrade to {tierLabel} to unlock {feature}
        </span>
      </div>
      <Button asChild size="sm" variant="default">
        <Link href="/my/selling/subscription">Upgrade Plan</Link>
      </Button>
    </div>
  );
}
