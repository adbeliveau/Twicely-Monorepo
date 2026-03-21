"use client";

import { useRef, useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

export interface ActiveFilter {
  key: string;
  value: string;
  label: string;
  category: "status" | "priority" | "type" | "team" | "sla";
}

interface FilterChipBarProps {
  activeFilters: ActiveFilter[];
  onRemoveFilter: (key: string, value: string) => void;
  onAddFilter: (key: string, value: string) => void;
  teams?: Array<{ id: string; name: string }>;
}

// =============================================================================
// COLOR MAPS
// =============================================================================

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  URGENT:   "#f97316",
  HIGH:     "#f59e0b",
  NORMAL:   "#3b82f6",
  LOW:      "#6b7280",
};

const STATUS_BG: Record<string, string> = {
  NEW:               "rgba(59,130,246,0.15)",
  OPEN:              "rgba(34,197,94,0.15)",
  PENDING_USER:      "rgba(245,158,11,0.15)",
  PENDING_INTERNAL:  "rgba(168,85,247,0.15)",
  ON_HOLD:           "rgba(107,114,128,0.15)",
  ESCALATED:         "rgba(239,68,68,0.15)",
  RESOLVED:          "rgba(16,185,129,0.15)",
  CLOSED:            "rgba(100,116,139,0.15)",
};

const STATUS_TEXT: Record<string, string> = {
  NEW:               "#3b82f6",
  OPEN:              "#22c55e",
  PENDING_USER:      "#f59e0b",
  PENDING_INTERNAL:  "#a855f7",
  ON_HOLD:           "#6b7280",
  ESCALATED:         "#ef4444",
  RESOLVED:          "#10b981",
  CLOSED:            "#64748b",
};

function getChipStyle(filter: ActiveFilter): React.CSSProperties {
  if (filter.category === "priority") {
    const color = PRIORITY_COLORS[filter.value] ?? "#6b7280";
    return { background: `${color}25`, color, borderColor: `${color}50` };
  }
  if (filter.category === "status") {
    return {
      background: STATUS_BG[filter.value] ?? "rgba(107,114,128,0.15)",
      color: STATUS_TEXT[filter.value] ?? "#6b7280",
      borderColor: `${STATUS_TEXT[filter.value] ?? "#6b7280"}40`,
    };
  }
  if (filter.category === "sla") {
    return { background: "rgba(239,68,68,0.15)", color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" };
  }
  return { background: "rgba(107,114,128,0.1)", color: "rgb(var(--hd-text-secondary))", borderColor: "rgb(var(--hd-border))" };
}

// =============================================================================
// CHIP
// =============================================================================

function FilterChip({ filter, onRemove }: { filter: ActiveFilter; onRemove: () => void }) {
  const chipStyle = getChipStyle(filter);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border" style={chipStyle}>
      {filter.category === "sla" && <AlertTriangle className="h-3 w-3" />}
      {filter.label}
      <button type="button" onClick={onRemove} className="ml-0.5 rounded-full hover:opacity-70">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// =============================================================================
// POPOVER FILTER SELECTOR
// =============================================================================

interface PopoverOption { value: string; label: string }

function FilterPopover({
  label, options, activeValues, onToggle, onClose,
}: {
  label: string;
  options: PopoverOption[];
  activeValues: Set<string>;
  onToggle: (v: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 w-56 rounded-lg border shadow-xl z-50 overflow-hidden" style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}>
      <div className="px-3 py-2 border-b text-xs font-semibold uppercase tracking-wide" style={{ borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-muted))" }}>{label}</div>
      <div className="p-1 max-h-56 overflow-y-auto hd-scrollbar">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hd-transition text-sm" style={{ color: "rgb(var(--hd-text-secondary))" }}>
            <input type="checkbox" checked={activeValues.has(opt.value)} onChange={() => onToggle(opt.value)} className="rounded" />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// FILTER CHIP BAR
// =============================================================================

const STATUS_OPTIONS: PopoverOption[] = [
  { value: "NEW", label: "New" }, { value: "OPEN", label: "Open" },
  { value: "PENDING_USER", label: "Pending User" }, { value: "PENDING_INTERNAL", label: "Pending Internal" },
  { value: "ON_HOLD", label: "On Hold" }, { value: "ESCALATED", label: "Escalated" },
  { value: "RESOLVED", label: "Resolved" }, { value: "CLOSED", label: "Closed" },
];

const PRIORITY_OPTIONS: PopoverOption[] = [
  { value: "CRITICAL", label: "Critical" }, { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" }, { value: "NORMAL", label: "Normal" }, { value: "LOW", label: "Low" },
];

const TYPE_OPTIONS: PopoverOption[] = [
  { value: "SUPPORT", label: "Support" }, { value: "ORDER", label: "Order" },
  { value: "RETURN", label: "Return" }, { value: "DISPUTE", label: "Dispute" },
  { value: "CHARGEBACK", label: "Chargeback" }, { value: "BILLING", label: "Billing" },
  { value: "ACCOUNT", label: "Account" }, { value: "MODERATION", label: "Moderation" }, { value: "SYSTEM", label: "System" },
];

const SLA_OPTIONS: PopoverOption[] = [
  { value: "BREACHED", label: "Breached" }, { value: "WARNING", label: "Warning" }, { value: "ON_TRACK", label: "On Track" },
];

type PopoverCategory = "status" | "priority" | "type" | "team" | "sla" | null;

export function FilterChipBar({ activeFilters, onRemoveFilter, onAddFilter, teams = [] }: FilterChipBarProps) {
  const [openPopover, setOpenPopover] = useState<PopoverCategory>(null);

  const activeValuesByKey = activeFilters.reduce<Record<string, Set<string>>>((acc, f) => {
    if (!acc[f.key]) acc[f.key] = new Set();
    (acc[f.key] as Set<string>).add(f.value);
    return acc;
  }, {});

  function handleToggle(key: string, value: string) {
    const set = activeValuesByKey[key];
    if (set?.has(value)) {
      onRemoveFilter(key, value);
    } else {
      onAddFilter(key, value);
    }
  }

  const teamOptions: PopoverOption[] = teams.map((t) => ({ value: t.id, label: t.name }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Active chips */}
      {activeFilters.map((f) => (
        <FilterChip key={`${f.key}-${f.value}`} filter={f} onRemove={() => onRemoveFilter(f.key, f.value)} />
      ))}

      {/* Add filter buttons */}
      {(["status", "priority", "type", "team", "sla"] as PopoverCategory[]).map((cat) => {
        if (cat === null) return null;
        const labelMap: Record<string, string> = { status: "+ Status", priority: "+ Priority", type: "+ Type", team: "+ Team", sla: "+ SLA" };
        const label = labelMap[cat] ?? `+ ${cat}`;
        let options: PopoverOption[] = [];
        let filterKey: string = cat;
        if (cat === "status") { options = STATUS_OPTIONS; filterKey = "status"; }
        else if (cat === "priority") { options = PRIORITY_OPTIONS; filterKey = "priority"; }
        else if (cat === "type") { options = TYPE_OPTIONS; filterKey = "type"; }
        else if (cat === "team") { options = teamOptions; filterKey = "teamId"; }
        else if (cat === "sla") { options = SLA_OPTIONS; filterKey = "sla"; }

        const activeSet = activeValuesByKey[filterKey] ?? new Set<string>();

        return (
          <div key={cat} className="relative">
            <button
              type="button"
              onClick={() => setOpenPopover((p) => (p === cat ? null : cat))}
              className="px-2 py-1 text-xs rounded-full border hd-transition"
              style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-dim))" }}
            >
              {label}
            </button>
            {openPopover === cat && (
              <FilterPopover
                label={label.replace("+ ", "")}
                options={options}
                activeValues={activeSet}
                onToggle={(v) => handleToggle(filterKey, v)}
                onClose={() => setOpenPopover(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
