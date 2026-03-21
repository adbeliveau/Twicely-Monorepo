"use client";

import { useState, useRef, useEffect } from "react";
import { getAiAssist } from "@/lib/actions/helpdesk-ai";

// =============================================================================
// TYPES
// =============================================================================

type AssistAction = 'REWRITE' | 'SUMMARIZE' | 'TRANSLATE_ES' | 'TRANSLATE_FR';

interface AiAssistDropdownProps {
  body: string;
  onResult: (text: string) => void;
  assistEnabled: boolean;
}

const ACTIONS: Array<{ action: AssistAction; label: string }> = [
  { action: 'REWRITE', label: 'Rewrite' },
  { action: 'SUMMARIZE', label: 'Summarize' },
  { action: 'TRANSLATE_ES', label: 'Translate to Spanish' },
  { action: 'TRANSLATE_FR', label: 'Translate to French' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function AiAssistDropdown({ body, onResult, assistEnabled }: AiAssistDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!assistEnabled) return null;

  const isEmpty = !body.trim();

  async function handleAction(action: AssistAction) {
    setOpen(false);
    setLoading(true);
    try {
      const result = await getAiAssist({ body, action });
      if (result.success && result.data?.result) {
        onResult(result.data.result);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !isEmpty && setOpen((s) => !s)}
        disabled={isEmpty || loading}
        className="px-3 py-1.5 text-sm rounded-md border hd-transition flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}
      >
        {loading ? (
          <><span className="animate-spin text-xs">⏳</span><span>AI Assist</span></>
        ) : (
          <><span>✨</span><span>AI Assist</span></>
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-52 border rounded-lg shadow-xl overflow-hidden z-50"
          style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}
        >
          {ACTIONS.map(({ action, label }) => (
            <button
              key={action}
              type="button"
              onClick={() => void handleAction(action)}
              className="w-full text-left px-3 py-2 text-sm hd-transition flex items-center gap-2"
              style={{ color: "rgb(var(--hd-text-secondary))" }}
            >
              <span className="text-xs">✨</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
