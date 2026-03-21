'use client';

import type { TaxDocument } from '@/lib/queries/tax-documents';
import { Badge } from '@twicely/ui/badge';

interface TaxDocumentsListProps {
  documents: TaxDocument[];
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  '1099_K': '1099-K Summary',
  '1099_NEC': '1099-NEC Summary',
};

export function TaxDocumentsList({ documents }: TaxDocumentsListProps) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tax documents available yet.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium">
              {REPORT_TYPE_LABELS[doc.reportType] ?? doc.reportType}{' '}
              <Badge variant="outline" className="ml-1 text-xs">
                {doc.taxYear}
              </Badge>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              For your records — official form filed electronically by Twicely through Stripe
            </p>
          </div>
          {doc.fileUrl ? (
            <a
              href={`/api/tax-documents/${doc.id}`}
              className="text-sm text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Processing</span>
          )}
        </li>
      ))}
    </ul>
  );
}
