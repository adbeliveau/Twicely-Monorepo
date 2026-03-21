'use client';

import DOMPurify from 'dompurify';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

interface StoreInfoCardsProps {
  aboutHtml: string | null | undefined;
  returnPolicy: string | null | undefined;
}

export function StoreInfoCards({ aboutHtml, returnPolicy }: StoreInfoCardsProps) {
  if (!aboutHtml && !returnPolicy) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {aboutHtml && (
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(aboutHtml) }}
            />
          </CardContent>
        </Card>
      )}

      {returnPolicy && (
        <Card>
          <CardHeader>
            <CardTitle>Return Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {returnPolicy}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
