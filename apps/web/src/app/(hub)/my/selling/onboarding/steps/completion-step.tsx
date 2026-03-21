'use client';

import Link from 'next/link';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { CheckCircle2 } from 'lucide-react';

interface CompletionStepProps {
  storeName: string | null;
}

export function CompletionStep({ storeName }: CompletionStepProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <div>
            <CardTitle>
              {storeName ? `${storeName} is ready!` : 'Your store is ready!'}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-muted-foreground">
          Your business account is set up. You can now subscribe to a store plan to unlock your
          storefront, invite staff, and access advanced seller tools.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/my/selling/listings/new">Create your first listing</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/my/selling/subscription">Explore subscription plans</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
