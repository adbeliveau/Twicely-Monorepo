"use client";

import { useEffect, useRef } from "react";

// =============================================================================
// SHORTCUT DEFINITIONS (Canonical §6.2)
// =============================================================================

export const HELPDESK_SHORTCUTS = [
  { key: "R", description: "Focus reply (reply mode)" },
  { key: "N", description: "Focus reply (internal note mode)" },
  { key: "E", description: "Escalate case" },
  { key: "M", description: "Toggle macro picker" },
  { key: "?", description: "Toggle shortcut help" },
  { key: "[ / ←", description: "Previous case in queue" },
  { key: "] / →", description: "Next case in queue" },
  { key: "1–5", description: "Set priority (1=Critical, 5=Low)" },
  { key: "⌘⇧R", description: "Resolve case" },
  { key: "⌘↵", description: "Send reply / add note" },
  { key: "⌘I", description: "Toggle reply / internal note mode" },
  { key: "⌘M", description: "Toggle macros" },
] as const;

// =============================================================================
// COMPONENT
// =============================================================================

interface ShortcutHelpOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

export function ShortcutHelpOverlay({ isVisible, onClose }: ShortcutHelpOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isVisible, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      style={{ background: "rgba(0,0,0,0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        ref={overlayRef}
        className="rounded-xl border shadow-2xl w-full max-w-sm overflow-hidden"
        style={{
          background: "rgb(var(--hd-bg-panel))",
          borderColor: "rgb(var(--hd-border))",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "rgb(var(--hd-border))" }}
        >
          <span className="font-semibold text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>
            Keyboard Shortcuts
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-sm hd-transition"
            style={{ color: "rgb(var(--hd-text-muted))" }}
            aria-label="Close shortcut help"
          >
            ✕
          </button>
        </div>

        {/* Shortcut list */}
        <div className="p-4 space-y-2">
          {HELPDESK_SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-xs">
              <span style={{ color: "rgb(var(--hd-text-secondary))" }}>{s.description}</span>
              <kbd
                className="rounded border px-2 py-0.5 font-mono text-[11px]"
                style={{
                  background: "rgb(var(--hd-bg-card))",
                  borderColor: "rgb(var(--hd-border))",
                  color: "rgb(var(--hd-text-primary))",
                }}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          className="px-5 py-3 border-t text-[11px] text-center"
          style={{ borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-dim))" }}
        >
          Press <kbd className="hd-kbd">?</kbd> or <kbd className="hd-kbd">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
