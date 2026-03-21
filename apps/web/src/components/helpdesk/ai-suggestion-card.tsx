"use client";

import { useState, useEffect, useCallback } from "react";
import { getAiSuggestion } from "@/lib/actions/helpdesk-ai";

// =============================================================================
// PROPS
// =============================================================================

interface AiSuggestionCardProps {
  caseId: string;
  suggestionEnabled: boolean;
  onUseSuggestion: (text: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AiSuggestionCard({ caseId, suggestionEnabled, onUseSuggestion }: AiSuggestionCardProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchSuggestion = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    try {
      const result = await getAiSuggestion({ caseId });
      if (result.success && result.data?.suggestion) {
        setSuggestion(result.data.suggestion);
      } else {
        setSuggestion(null);
        setUnavailable(true);
      }
    } catch {
      setSuggestion(null);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (!suggestionEnabled || dismissed) return;
    void fetchSuggestion();
  }, [suggestionEnabled, dismissed, fetchSuggestion]);

  if (!suggestionEnabled || dismissed) return null;

  return (
    <div
      className="mx-4 mb-3 rounded-lg border overflow-hidden"
      style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgba(139,92,246,0.3)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.05)" }}>
        <div className="flex items-center gap-2">
          <span className="text-sm">✨</span>
          <span className="text-xs font-semibold" style={{ color: "rgb(var(--hd-text-primary))" }}>AI Suggested Reply</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background: "rgba(139,92,246,0.15)", color: "rgb(139,92,246)" }}>Powered by AI</span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs hover:underline"
          style={{ color: "rgb(var(--hd-text-dim))" }}
        >
          Dismiss
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 rounded" style={{ background: "rgb(var(--hd-bg-panel))", width: "80%" }} />
            <div className="h-3 rounded" style={{ background: "rgb(var(--hd-bg-panel))", width: "65%" }} />
            <div className="h-3 rounded" style={{ background: "rgb(var(--hd-bg-panel))", width: "72%" }} />
          </div>
        ) : unavailable || !suggestion ? (
          <p className="text-xs italic" style={{ color: "rgb(var(--hd-text-dim))" }}>AI suggestion unavailable</p>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "rgb(var(--hd-text-secondary))" }}>{suggestion}</p>
        )}
      </div>

      {/* Footer */}
      {!loading && !unavailable && suggestion && (
        <div className="flex items-center gap-2 px-4 py-2 border-t" style={{ borderColor: "rgba(139,92,246,0.2)" }}>
          <button
            type="button"
            onClick={() => onUseSuggestion(suggestion)}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-white hd-transition"
            style={{ background: "rgb(139,92,246)" }}
          >
            Use Suggestion
          </button>
          <button
            type="button"
            onClick={() => void fetchSuggestion()}
            className="px-3 py-1.5 text-xs rounded-md border hd-transition"
            style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
