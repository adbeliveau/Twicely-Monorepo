'use client';

import { useRouter } from 'next/navigation';
import { Input } from '@twicely/ui/input';
import { Button } from '@twicely/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@twicely/ui/select';
import { exportAuditLogCsv } from '@/lib/actions/admin-audit-export';
import type { AuditLogQuery } from '@/lib/queries/admin-audit-log-schemas';

const ACTOR_TYPES = ['STAFF', 'USER', 'SYSTEM'];
const SUBJECTS = [
  'Listing', 'Order', 'User', 'Setting', 'FeatureFlag', 'StaffUser',
  'Payout', 'Return', 'Dispute', 'HealthCheck', 'ContentReport',
  'EnforcementAction', 'CustomRole', 'KbArticle', 'HelpdeskCase',
  'Subscription', 'CrosslisterAccount', 'Message', 'Review',
];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface AuditLogFiltersProps {
  currentFilters: AuditLogQuery;
}

export function AuditLogFilters({ currentFilters }: AuditLogFiltersProps) {
  const router = useRouter();

  function applyFilter(key: string, value: string | undefined) {
    const params = new URLSearchParams();
    const current = { ...currentFilters, [key]: value || undefined, page: 1 };
    for (const [k, v] of Object.entries(current)) {
      if (v !== undefined && v !== null && v !== '') {
        params.set(k, String(v));
      }
    }
    router.push(`/audit?${params.toString()}`);
  }

  function clearFilters() {
    router.push('/audit');
  }

  async function handleExport() {
    const result = await exportAuditLogCsv(currentFilters);
    if ('error' in result) return;
    const blob = new Blob([result.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const hasFilters = !!(
    currentFilters.actorType ||
    currentFilters.action ||
    currentFilters.subject ||
    currentFilters.severity ||
    currentFilters.startDate ||
    currentFilters.endDate
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={currentFilters.actorType ?? '_all'}
          onValueChange={(v) => applyFilter('actorType', v === '_all' ? undefined : v)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Actor Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Actors</SelectItem>
            {ACTOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.subject ?? '_all'}
          onValueChange={(v) => applyFilter('subject', v === '_all' ? undefined : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Subjects</SelectItem>
            {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.severity ?? '_all'}
          onValueChange={(v) => applyFilter('severity', v === '_all' ? undefined : v)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All</SelectItem>
            {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter by action..."
          className="w-44"
          defaultValue={currentFilters.action ?? ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              applyFilter('action', (e.target as HTMLInputElement).value || undefined);
            }
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            defaultValue={currentFilters.startDate ? currentFilters.startDate.slice(0, 10) : ''}
            onBlur={(e) => {
              const val = e.target.value;
              applyFilter('startDate', val ? `${val}T00:00:00.000Z` : undefined);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            defaultValue={currentFilters.endDate ? currentFilters.endDate.slice(0, 10) : ''}
            onBlur={(e) => {
              const val = e.target.value;
              applyFilter('endDate', val ? `${val}T23:59:59.999Z` : undefined);
            }}
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">50 per page</span>
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
