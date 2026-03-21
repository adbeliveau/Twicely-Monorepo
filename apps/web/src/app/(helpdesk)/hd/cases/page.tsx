"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, RefreshCw, Inbox } from "lucide-react";
import { CaseRow } from "./case-row";
import type { CaseRowData } from "./case-row";
import { FilterChipBar } from "@/components/helpdesk/filter-chip-bar";
import type { ActiveFilter } from "@/components/helpdesk/filter-chip-bar";

export default function CasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<CaseRowData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      const res = await fetch(`/api/hub/helpdesk/cases?${params.toString()}`);
      const data = await res.json() as { cases?: CaseRowData[]; total?: number };
      setCases(data.cases ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // silently handle
    }
    setLoading(false);
  }, [searchParams]);

  useEffect(() => { void loadCases(); }, [loadCases]);

  // Keyboard navigation (J/K/Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = selectedCaseId ? cases.findIndex((c) => c.id === selectedCaseId) : -1;
      if (e.key === "j" && idx < cases.length - 1) {
        e.preventDefault();
        setSelectedCaseId(cases[idx + 1]?.id ?? cases[0]?.id ?? null);
      } else if (e.key === "k" && idx > 0) {
        e.preventDefault();
        setSelectedCaseId(cases[idx - 1]?.id ?? null);
      } else if (e.key === "Enter" && selectedCaseId) {
        e.preventDefault();
        router.push(`/hd/cases/${selectedCaseId}`);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cases, selectedCaseId, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search); else params.delete("search");
    router.push(`/hd/cases?${params.toString()}`);
  };

  const setFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`/hd/cases?${params.toString()}`);
  };

  // Build active filters from URL params for chip bar
  const FILTER_KEYS = ["status", "priority", "type", "teamId", "sla"] as const;
  const LABEL_MAPS: Record<string, Record<string, string>> = {
    status: { NEW: "New", OPEN: "Open", PENDING_USER: "Pending User", PENDING_INTERNAL: "Pending Internal", ON_HOLD: "On Hold", ESCALATED: "Escalated", RESOLVED: "Resolved", CLOSED: "Closed" },
    priority: { CRITICAL: "Critical", URGENT: "Urgent", HIGH: "High", NORMAL: "Normal", LOW: "Low" },
    type: { SUPPORT: "Support", ORDER: "Order", RETURN: "Return", DISPUTE: "Dispute", CHARGEBACK: "Chargeback", BILLING: "Billing", ACCOUNT: "Account", MODERATION: "Moderation", SYSTEM: "System" },
    sla: { BREACHED: "SLA Breached", WARNING: "SLA Warning", ON_TRACK: "SLA On Track" },
  };
  const CATEGORY_MAP: Record<string, ActiveFilter["category"]> = { status: "status", priority: "priority", type: "type", teamId: "team", sla: "sla" };

  const activeFilters: ActiveFilter[] = FILTER_KEYS.flatMap((key) => {
    const val = searchParams.get(key);
    if (!val) return [];
    const cat = CATEGORY_MAP[key] ?? "team";
    const label = LABEL_MAPS[key]?.[val] ?? val;
    return [{ key, value: val, label, category: cat }];
  });

  const handleAddFilter = (key: string, value: string) => setFilter(key, value);
  const handleRemoveFilter = (key: string) => setFilter(key, null);

  const formatTimeAgo = (date: string) => {
    const diffMs = Date.now() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const getSlaStatus = (c: CaseRowData) => {
    if (!c.slaFirstResponseDue || c.firstResponseAt) return null;
    const due = new Date(c.slaFirstResponseDue);
    const diffMs = due.getTime() - Date.now();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMs < 0) return { label: "BREACHED", className: "hd-sla-breach" };
    if (diffMins < 60) return { label: `${diffMins}m`, className: "hd-sla-warning" };
    return { label: `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`, className: "hd-sla" };
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "rgb(var(--hd-text-primary))" }}>Cases</h1>
          <p className="text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>{total} total cases</p>
        </div>
        <button
          onClick={() => void loadCases()}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-800/50"
          style={{ color: "rgb(var(--hd-text-secondary))" }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters Bar */}
      <div
        className="p-3 rounded-lg border space-y-2"
        style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))" }}
      >
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "rgb(var(--hd-text-muted))" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by case # or subject..."
              className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-primary))" }}
            />
          </div>
        </form>
        <FilterChipBar
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onAddFilter={handleAddFilter}
        />
      </div>

      {/* Case List */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}
      >
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
              <span style={{ color: "rgb(var(--hd-text-muted))" }}>Loading cases...</span>
            </div>
          </div>
        ) : cases.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <Inbox className="h-12 w-12" style={{ color: "rgb(var(--hd-text-muted))" }} />
            <p style={{ color: "rgb(var(--hd-text-muted))" }}>No cases found</p>
          </div>
        ) : (
          <div>
            {cases.map((c) => (
              <CaseRow
                key={c.id}
                caseData={c}
                isSelected={c.id === selectedCaseId}
                onSelect={() => setSelectedCaseId(c.id)}
                formatTimeAgo={formatTimeAgo}
                getSlaStatus={getSlaStatus}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer keyboard hints */}
      <div className="flex items-center justify-center gap-4 text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>
        <span className="flex items-center gap-1">
          <kbd className="hd-kbd">J</kbd>
          <kbd className="hd-kbd">K</kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="hd-kbd">Enter</kbd>
          Open case
        </span>
      </div>
    </div>
  );
}
