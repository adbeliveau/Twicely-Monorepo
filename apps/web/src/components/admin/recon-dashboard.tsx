'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import { Badge } from '@twicely/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import { RefreshCw } from 'lucide-react';
import type {
  ReconciliationSummary,
  BalanceComparison,
  Discrepancy,
  ReconHistoryEntry,
  DiscrepancySeverity,
  ReconStatus,
} from '@/lib/queries/reconciliation';

interface ReconDashboardProps {
  summary: ReconciliationSummary;
  balance: BalanceComparison;
  discrepancies: Discrepancy[];
  discrepancyTotal: number;
  history: ReconHistoryEntry[];
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function statusColor(status: ReconStatus): string {
  switch (status) {
    case 'CLEAN': return 'bg-green-500';
    case 'DISCREPANCIES': return 'bg-yellow-500';
    case 'FAILED': return 'bg-red-500';
    case 'NEVER_RUN': return 'bg-gray-400';
  }
}

function statusBadge(status: ReconStatus) {
  const variant = status === 'CLEAN' ? 'default' :
    status === 'DISCREPANCIES' ? 'secondary' :
    status === 'FAILED' ? 'destructive' : 'outline';
  return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
}

function severityBadge(severity: DiscrepancySeverity) {
  const variant = severity === 'CRITICAL' ? 'destructive' :
    severity === 'HIGH' ? 'secondary' : 'outline';
  return <Badge variant={variant} className="text-xs">{severity}</Badge>;
}

export function ReconDashboard({
  summary,
  balance,
  discrepancies,
  discrepancyTotal,
  history,
}: ReconDashboardProps) {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const filtered = severityFilter === 'ALL'
    ? discrepancies
    : discrepancies.filter((d) => d.severity === severityFilter);

  return (
    <div className="space-y-6">
      {/* Status + Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${statusColor(summary.status)}`} />
              <div>
                <p className="text-xs text-gray-500">Status</p>
                {statusBadge(summary.status)}
              </div>
            </div>
            {summary.lastRunAt && (
              <p className="text-xs text-gray-400 mt-2">
                Last run: {summary.lastRunAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </CardContent>
        </Card>

        <StatMini label="Entries Checked" value={summary.entriesChecked} />
        <StatMini label="Discrepancies" value={summary.discrepanciesFound} />
        <StatMini label="Auto-Resolved" value={summary.autoResolved} />
        <StatMini label="Pending Review" value={summary.pendingManualReview} />
      </div>

      {/* Stripe vs Platform Balance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stripe vs Platform Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">Stripe Balance</p>
              <p className="text-lg font-semibold">{formatCents(balance.stripeBalanceCents)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Platform Liability</p>
              <p className="text-lg font-semibold">{formatCents(balance.platformLiabilityCents)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Difference</p>
              <p className={`text-lg font-semibold ${balance.differenceCents !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCents(balance.differenceCents)}
              </p>
            </div>
          </div>
          {balance.lastUpdated && (
            <p className="text-xs text-gray-400 mt-2">
              Updated: {balance.lastUpdated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          {!balance.lastUpdated && (
            <p className="text-xs text-gray-400 mt-2">No reconciliation data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Discrepancies */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Discrepancies ({discrepancyTotal})</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All severities</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled title="Available when reconciliation engine is active">
              <RefreshCw className="h-4 w-4 mr-1" />
              Run Reconciliation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {summary.status === 'NEVER_RUN'
                ? 'Reconciliation has not run yet.'
                : 'No discrepancies found.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium text-gray-600">Type</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Severity</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Expected</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Actual</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Diff</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Status</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Seller</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{d.type}</td>
                      <td className="px-3 py-2">{severityBadge(d.severity)}</td>
                      <td className="px-3 py-2">{formatCents(d.expectedAmountCents)}</td>
                      <td className="px-3 py-2">{formatCents(d.actualAmountCents)}</td>
                      <td className="px-3 py-2 text-red-600">{formatCents(d.differenceCents)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs">{d.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{d.sellerName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reconciliation History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No reconciliation runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium text-gray-600">Date</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Status</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Entries Checked</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Issues Found</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="px-3 py-2 text-gray-500">
                        {h.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-2">{statusBadge(h.status)}</td>
                      <td className="px-3 py-2">{h.entriesChecked}</td>
                      <td className="px-3 py-2">{h.issuesFound}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
