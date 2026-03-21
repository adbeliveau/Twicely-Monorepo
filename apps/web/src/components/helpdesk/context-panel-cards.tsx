"use client";

import { useState } from "react";

// =============================================================================
// KNOWLEDGE BASE SECTION
// =============================================================================

export function KnowledgeBaseSection() {
  const [query, setQuery] = useState("");
  return (
    <div className="hd-context-card">
      <div className="hd-context-header"><span>📚</span><span>Knowledge Base</span></div>
      <div className="hd-context-body">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Search help articles..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border py-1.5 pl-8 pr-3 text-sm outline-none hd-transition"
            style={{ borderColor: "rgb(var(--hd-border))", background: "transparent", color: "rgb(var(--hd-text-primary))" }}
          />
        </div>
        {!query && (
          <p className="mt-2 text-center py-3 text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>
            Search for help articles to link to this case
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// TAGS SECTION
// =============================================================================

export function TagsSection({ tags }: { tags: string[] }) {
  return (
    <div className="hd-context-card">
      <div className="hd-context-header"><span>🏷️</span><span>Tags</span></div>
      <div className="hd-context-body">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: "rgb(var(--hd-bg-hover))", color: "rgb(var(--hd-text-secondary))" }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PREVIOUS CASES SECTION
// =============================================================================

export function PreviousCasesSection({ cases }: { cases: { caseNumber: string; subject: string; status: string }[] }) {
  return (
    <div className="hd-context-card">
      <div className="hd-context-header"><span>📜</span><span>Previous Cases ({cases.length})</span></div>
      <div className="hd-context-body space-y-2">
        {cases.slice(0, 3).map((c) => (
          <div key={c.caseNumber} className="rounded-md hd-transition" style={{ background: "rgb(var(--hd-bg-hover))", padding: "8px 10px" }}>
            <p className="truncate text-xs font-mono" style={{ color: "rgb(var(--hd-text-muted))" }}>{c.caseNumber}</p>
            <p className="truncate text-xs" style={{ color: "rgb(var(--hd-text-secondary))" }}>{c.subject}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// ASSIGNMENT SECTION
// =============================================================================

export function AssignmentSection({ agentName, teamName, hasAgent }: {
  agentName?: string; teamName?: string; hasAgent: boolean;
}) {
  return (
    <div className="hd-context-card">
      <div className="hd-context-header"><span>👥</span><span>Assignment</span></div>
      <div className="hd-context-body">
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "rgb(var(--hd-text-muted))" }}>Agent</span>
          <span style={{ color: hasAgent ? "rgb(var(--hd-text-primary))" : "rgb(245,158,11)" }}>
            {agentName ?? (hasAgent ? "Assigned" : "Unassigned")}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span style={{ color: "rgb(var(--hd-text-muted))" }}>Team</span>
          <span style={{ color: "rgb(var(--hd-text-primary))" }}>{teamName ?? "—"}</span>
        </div>
        <button
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hd-transition"
          style={{ borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}
        >
          👤 {hasAgent ? "Reassign" : "Assign Agent"}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// KEYBOARD SHORTCUTS SECTION — Canonical §6.2
// =============================================================================

export function KeyboardShortcutsSection() {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-medium mb-2" style={{ color: "rgb(var(--hd-text-muted))" }}>Keyboard Shortcuts</p>
      <div className="space-y-1 text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>
        <div className="flex justify-between"><span>Reply</span><kbd className="hd-kbd">R</kbd></div>
        <div className="flex justify-between"><span>Internal Note</span><kbd className="hd-kbd">N</kbd></div>
        <div className="flex justify-between"><span>Escalate</span><kbd className="hd-kbd">E</kbd></div>
        <div className="flex justify-between"><span>Toggle Macros</span><kbd className="hd-kbd">M</kbd></div>
        <div className="flex justify-between"><span>Shortcut Help</span><kbd className="hd-kbd">?</kbd></div>
        <div className="flex justify-between">
          <span>Prev/Next Case</span>
          <span><kbd className="hd-kbd">[</kbd> <kbd className="hd-kbd">]</kbd></span>
        </div>
        <div className="flex justify-between"><span>Set Priority 1–5</span><span className="hd-kbd">1–5</span></div>
        <div className="flex justify-between"><span>Resolve</span><kbd className="hd-kbd">⌘⇧R</kbd></div>
        <div className="flex justify-between"><span>Send</span><kbd className="hd-kbd">⌘↵</kbd></div>
        <div className="flex justify-between"><span>Toggle Mode</span><kbd className="hd-kbd">⌘I</kbd></div>
      </div>
    </div>
  );
}
