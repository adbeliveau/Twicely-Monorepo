'use client';

import { useRef } from 'react';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { formatCentsToDollars } from '@twicely/finance/format';
import type { ReceiptOcrResult } from '@twicely/finance/receipt-ocr';

interface ReceiptUploadProps {
  receiptUrl: string | null;
  ocrSuggestions: ReceiptOcrResult | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onApplyVendor: (vendor: string) => void;
  onApplyAmount: (amountCents: number) => void;
  onApplyDate: (date: string) => void;
  onApplyCategory: (category: string) => void;
}

export function ReceiptUpload({
  receiptUrl,
  ocrSuggestions,
  uploading,
  onUpload,
  onRemove,
  onApplyVendor,
  onApplyAmount,
  onApplyDate,
  onApplyCategory,
}: ReceiptUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      // Reset input so the same file can be re-selected
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <Label>Receipt photo (optional)</Label>

      {receiptUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptUrl}
              alt="Receipt"
              className="h-20 w-20 object-cover rounded border"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRemove}
              disabled={uploading}
            >
              Remove receipt
            </Button>
          </div>

          {/* OCR suggestions */}
          {ocrSuggestions && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                AI detected from receipt:
              </p>
              {ocrSuggestions.vendor && (
                <div className="flex items-center justify-between text-xs">
                  <span>Vendor: <strong>{ocrSuggestions.vendor}</strong></span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onApplyVendor(ocrSuggestions.vendor!)}
                  >
                    Apply
                  </Button>
                </div>
              )}
              {ocrSuggestions.amountCents !== null && (
                <div className="flex items-center justify-between text-xs">
                  <span>Amount: <strong>{formatCentsToDollars(ocrSuggestions.amountCents)}</strong></span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onApplyAmount(ocrSuggestions.amountCents!)}
                  >
                    Apply
                  </Button>
                </div>
              )}
              {ocrSuggestions.date && (
                <div className="flex items-center justify-between text-xs">
                  <span>Date: <strong>{ocrSuggestions.date}</strong></span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onApplyDate(ocrSuggestions.date!)}
                  >
                    Apply
                  </Button>
                </div>
              )}
              {ocrSuggestions.suggestedCategory && (
                <div className="flex items-center justify-between text-xs">
                  <span>Category: <strong>{ocrSuggestions.suggestedCategory}</strong></span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onApplyCategory(ocrSuggestions.suggestedCategory!)}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload receipt'}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            JPEG, PNG, or WebP. Max 20MB.
          </p>
        </div>
      )}
    </div>
  );
}
