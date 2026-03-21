"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { mergeCases, searchCasesForMergeAction } from "@/lib/actions/helpdesk-merge";
import type { MergeSearchResult } from "@/lib/actions/helpdesk-merge";

// =============================================================================
// TYPES
// =============================================================================

interface MergeDialogProps {
  sourceCaseId: string;
  sourceCaseNumber: string;
  onClose: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MergeDialog({ sourceCaseId, sourceCaseNumber, onClose }: MergeDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MergeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<MergeSearchResult | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Debounced search
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setSelected(null);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found = await searchCasesForMergeAction(value, sourceCaseId);
        setResults(found);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [sourceCaseId]);

  async function handleConfirmMerge() {
    if (!selected || isMerging) return;
    setIsMerging(true);
    setError(null);
    const result = await mergeCases({ sourceCaseId, targetCaseId: selected.id });
    if (result.success) {
      router.push(`/hd/cases/${selected.id}`);
      router.refresh();
      onClose();
    } else {
      setError(result.error ?? "Merge failed");
      setIsMerging(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        ref={overlayRef}
        className="rounded-xl border shadow-2xl w-full max-w-md overflow-hidden"
        style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgb(var(--hd-border))" }}>
          <span className="font-semibold text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>
            Merge {sourceCaseNumber} into another case
          </span>
          <button type="button" onClick={onClose} className="text-sm hd-transition" style={{ color: "rgb(var(--hd-text-muted))" }}>✕</button>
        </div>

        <div className="p-5 space-y-4">
          {!selected ? (
            <>
              {/* Search input */}
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search by case number or subject..."
                autoFocus
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none hd-transition"
                style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-primary))" }}
              />

              {/* Results */}
              {isSearching && (
                <div className="text-center py-4 text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>Searching...</div>
              )}
              {!isSearching && results.length > 0 && (
                <div className="space-y-1 max-h-60 overflow-y-auto hd-scrollbar">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelected(r)}
                      className="w-full text-left rounded-lg px-3 py-2.5 hd-transition border"
                      style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))" }}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-mono text-xs" style={{ color: "rgb(var(--hd-text-dim))" }}>{r.caseNumber}</span>
                        <span className="text-[10px] uppercase" style={{ color: "rgb(var(--hd-text-muted))" }}>{r.status}</span>
                      </div>
                      <div className="text-sm truncate" style={{ color: "rgb(var(--hd-text-primary))" }}>{r.subject}</div>
                      {r.requesterEmail && (
                        <div className="text-xs truncate mt-0.5" style={{ color: "rgb(var(--hd-text-muted))" }}>{r.requesterEmail}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {!isSearching && query.trim() && results.length === 0 && (
                <div className="text-center py-4 text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>No open cases found</div>
              )}
            </>
          ) : (
            <>
              {/* Confirmation */}
              <div className="rounded-lg border p-4" style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))" }}>
                <p className="text-sm font-medium mb-1" style={{ color: "rgb(var(--hd-text-primary))" }}>
                  Merge <span className="font-mono">{sourceCaseNumber}</span> into <span className="font-mono">{selected.caseNumber}</span>?
                </p>
                <p className="text-sm" style={{ color: "rgb(var(--hd-text-secondary))" }}>{selected.subject}</p>
                <p className="text-xs mt-2" style={{ color: "rgb(245 158 11)" }}>This cannot be undone.</p>
              </div>

              {error && (
                <div className="text-sm text-red-500">{error}</div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setSelected(null); setError(null); }}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm hd-transition"
                  style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmMerge()}
                  disabled={isMerging}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold hd-transition disabled:opacity-50"
                  style={{ background: "rgb(239 68 68)", color: "white" }}
                >
                  {isMerging ? "Merging..." : "Confirm Merge"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
