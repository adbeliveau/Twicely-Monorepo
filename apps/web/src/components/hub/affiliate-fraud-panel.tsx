'use client';

import { useState, useTransition } from 'react';
import { runAffiliateFraudScan } from '@/lib/actions/affiliate-fraud-scan';
import type { FraudScanResult } from '@/lib/affiliate/fraud-detection';
import type { FraudSignalRow, RelatedAccount, FraudSummary } from '@/lib/queries/affiliate-fraud';

interface AffiliateFraudPanelProps {
  affiliateId: string;
  initialSignals: FraudSignalRow[];
  initialSummary: FraudSummary;
  initialRelatedAccounts: RelatedAccount[];
}

const RISK_COLOURS: Record<string, string> = {
  NONE: 'bg-gray-100 text-gray-600',
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const SEVERITY_COLOURS: Record<string, string> = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-yellow-600',
  HIGH: 'text-orange-600',
  CRITICAL: 'text-red-600',
};

export function AffiliateFraudPanel({
  affiliateId,
  initialSignals,
  initialSummary,
  initialRelatedAccounts,
}: AffiliateFraudPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [scanResult, setScanResult] = useState<FraudScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleRunScan() {
    setError(null);
    setScanResult(null);
    startTransition(async () => {
      const result = await runAffiliateFraudScan({ affiliateId });
      if (result.success && result.data) {
        setScanResult(result.data);
      } else {
        setError(result.error ?? 'Scan failed');
      }
    });
  }

  const riskColour = RISK_COLOURS[initialSummary.currentRiskLevel] ?? RISK_COLOURS.NONE;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Fraud Signals</h3>
        <button
          onClick={handleRunScan}
          disabled={isPending}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? 'Scanning…' : 'Run Fraud Scan'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded border border-gray-100 p-2 text-center">
          <p className="text-xs text-gray-500">Total Signals</p>
          <p className="text-lg font-semibold">{initialSummary.totalSignals}</p>
        </div>
        <div className="rounded border border-gray-100 p-2 text-center">
          <p className="text-xs text-gray-500">Warnings Issued</p>
          <p className="text-lg font-semibold">{initialSummary.warningsIssued}</p>
        </div>
        <div className="rounded border border-gray-100 p-2 text-center">
          <p className="text-xs text-gray-500">Risk Level</p>
          <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${riskColour}`}>
            {initialSummary.currentRiskLevel}
          </span>
        </div>
        <div className="rounded border border-gray-100 p-2 text-center">
          <p className="text-xs text-gray-500">Last Scan</p>
          <p className="text-xs font-medium">
            {initialSummary.lastScanDate
              ? initialSummary.lastScanDate.toLocaleDateString()
              : 'Never'}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Live scan results */}
      {scanResult && (
        <div className="rounded border border-gray-100 bg-gray-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">
            Scan complete — Highest severity:{' '}
            <span className={`font-bold ${SEVERITY_COLOURS[scanResult.highestSeverity] ?? ''}`}>
              {scanResult.highestSeverity}
            </span>
          </p>
          {scanResult.signals.length === 0 ? (
            <p className="text-xs text-gray-500">No fraud signals detected.</p>
          ) : (
            <ul className="space-y-1">
              {scanResult.signals.map((s) => (
                <li key={s.signalType} className="text-xs text-gray-700">
                  <span className="font-medium">{s.signalType}</span> — {s.details}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Signal history */}
      {initialSignals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">Signal History</p>
          <ul className="divide-y divide-gray-100">
            {initialSignals.map((sig) => {
              const details = sig.detailsJson as Record<string, unknown> | null;
              return (
                <li key={sig.id} className="py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${SEVERITY_COLOURS[sig.severity] ?? ''}`}>
                      {sig.action.replace('AFFILIATE_FRAUD_', '')}
                    </span>
                    <span className="text-gray-400">
                      {sig.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  {typeof details?.details === 'string' && (
                    <p className="mt-0.5 text-gray-500">{details.details}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Related accounts */}
      {initialRelatedAccounts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">Related Accounts (IP Overlap)</p>
          <ul className="divide-y divide-gray-100">
            {initialRelatedAccounts.map((acct) => (
              <li key={acct.userId} className="py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{acct.username ?? acct.userId}</span>
                  <span className="text-gray-400">{acct.emailMasked}</span>
                </div>
                <p className="mt-0.5 text-gray-500">
                  Shared IPs: {acct.sharedIps.slice(0, 3).join(', ')}
                  {acct.sharedIps.length > 3 && ` +${acct.sharedIps.length - 3} more`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
