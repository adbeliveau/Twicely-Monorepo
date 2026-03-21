import { AlertTriangle } from 'lucide-react';

type ExternalAuthDisclaimerProps = {
  buyerFeeCents?: number;
};

export function ExternalAuthDisclaimer({ buyerFeeCents }: ExternalAuthDisclaimerProps) {
  const feeDisplay = buyerFeeCents != null
    ? `$${(buyerFeeCents / 100).toFixed(2)} your share`
    : 'from $9.99 your share';

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-800">
            Third-party authentication referenced
          </p>
          <p className="text-sm text-amber-700">
            This seller references authentication from a third party. Twicely cannot verify
            external authentication claims.
          </p>
          <p className="text-sm text-amber-700">
            Request Twicely Authentication — {feeDisplay}
          </p>
        </div>
      </div>
    </div>
  );
}
