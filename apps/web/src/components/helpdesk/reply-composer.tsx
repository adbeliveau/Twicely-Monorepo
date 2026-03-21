"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { substituteMacroVariables } from "@/lib/helpdesk/macro-substitution";
import type { MacroContext } from "@/lib/helpdesk/macro-substitution";
import { AiAssistDropdown } from "./ai-assist-dropdown";

type ReplyMode = "reply" | "internal";

interface Macro {
  id: string;
  title: string;
  body: string;
  category?: string;
  shortcut?: string;
}

interface FocusRequest {
  mode: ReplyMode;
  counter: number;
}

interface ReplyComposerProps {
  recipientName?: string;
  macros?: Macro[];
  onSendReply: (body: string, attachments?: File[]) => Promise<void>;
  onSendNote: (body: string) => Promise<void>;
  isSubmitting?: boolean;
  replyPlaceholder?: string;
  notePlaceholder?: string;
  className?: string;
  macroContext?: MacroContext;
  focusRequest?: FocusRequest;
  macroToggleSignal?: number;
  aiAssistEnabled?: boolean;
  initialBody?: string;
}

export function ReplyComposer({
  recipientName = "customer", macros = [], onSendReply, onSendNote,
  isSubmitting = false, replyPlaceholder, notePlaceholder, className, macroContext, focusRequest, macroToggleSignal,
  aiAssistEnabled = false, initialBody,
}: ReplyComposerProps) {
  const [mode, setMode] = useState<ReplyMode>("reply");
  const [body, setBody] = useState(initialBody ?? "");
  const [showMacros, setShowMacros] = useState(false);
  const [macroSearch, setMacroSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const macroDropdownRef = useRef<HTMLDivElement>(null);

  // Sync initialBody when it changes (e.g. from AI suggestion card)
  const prevInitialBody = useRef(initialBody);
  useEffect(() => {
    if (initialBody !== undefined && initialBody !== prevInitialBody.current) {
      prevInitialBody.current = initialBody;
      setBody(initialBody);
      textareaRef.current?.focus();
    }
  }, [initialBody]);

  // Respond to external focus requests (from hotkeys R / N)
  const prevFocusCounter = useRef(0);
  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.counter !== prevFocusCounter.current) {
      prevFocusCounter.current = focusRequest.counter;
      setMode(focusRequest.mode);
      textareaRef.current?.focus();
    }
  }, [focusRequest]);

  // Respond to external macro toggle requests (from hotkey M)
  const prevMacroSignal = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (macroToggleSignal === undefined) return;
    if (macroToggleSignal !== prevMacroSignal.current) {
      prevMacroSignal.current = macroToggleSignal;
      setShowMacros((s) => !s);
    }
  }, [macroToggleSignal]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) { textarea.style.height = "auto"; textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`; }
  }, [body]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (macroDropdownRef.current && !macroDropdownRef.current.contains(e.target as Node)) setShowMacros(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = useCallback(async () => {
    if (!body.trim() || isSubmitting) return;
    try {
      if (mode === "reply") await onSendReply(body.trim());
      else await onSendNote(body.trim());
      setBody("");
    } catch { /* error handled by caller */ }
  }, [body, mode, isSubmitting, onSendReply, onSendNote]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void handleSend(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "i") { e.preventDefault(); setMode((m) => m === "reply" ? "internal" : "reply"); }
      if ((e.metaKey || e.ctrlKey) && e.key === "m") { e.preventDefault(); setShowMacros((s) => !s); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSend]);

  const useMacro = (macro: Macro) => {
    const resolved = macroContext
      ? substituteMacroVariables(macro.body, macroContext)
      : macro.body;
    setBody(resolved);
    setShowMacros(false);
    textareaRef.current?.focus();
  };

  const filteredMacros = macros.filter(
    (m) => m.title.toLowerCase().includes(macroSearch.toLowerCase()) || m.body.toLowerCase().includes(macroSearch.toLowerCase())
  );

  const groupedMacros = filteredMacros.reduce<Record<string, Macro[]>>((acc, macro) => {
    const category = macro.category ?? "General";
    if (!acc[category]) acc[category] = [];
    acc[category].push(macro);
    return acc;
  }, {});

  const placeholder = mode === "reply"
    ? (replyPlaceholder ?? `Type your reply to ${recipientName}...`)
    : (notePlaceholder ?? "Internal note (not visible to customer)...");

  return (
    <div className={cn("border-t p-4", className)} style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))" }}>
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "rgb(var(--hd-border))" }}>
          <button
            type="button"
            onClick={() => setMode("reply")}
            className={cn("px-4 py-2 text-sm font-medium hd-transition flex items-center gap-2 border-r",
              mode === "reply" ? "bg-blue-500/10 text-blue-500" : ""
            )}
            style={mode !== "reply" ? { background: "rgb(var(--hd-bg-card))", color: "rgb(var(--hd-text-muted))", borderColor: "rgb(var(--hd-border))" } : { borderColor: "rgba(59,130,246,0.3)" }}
          >
            <span>📤</span><span>Reply</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("internal")}
            className={cn("px-4 py-2 text-sm font-medium hd-transition flex items-center gap-2",
              mode === "internal" ? "bg-amber-500/10 text-amber-500" : ""
            )}
            style={mode !== "internal" ? { background: "rgb(var(--hd-bg-card))", color: "rgb(var(--hd-text-muted))" } : undefined}
          >
            <span>🔒</span><span>Internal</span>
          </button>
        </div>
        <span className="text-xs ml-2" style={{ color: "rgb(var(--hd-text-dim))" }}>⌘I to toggle</span>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        disabled={isSubmitting}
        rows={3}
        className={cn("w-full resize-none rounded-lg border p-3 text-sm outline-none hd-transition", isSubmitting && "opacity-50 cursor-not-allowed")}
        style={{
          background: mode === "reply" ? "rgb(var(--hd-bg-panel))" : "rgba(245,158,11,0.05)",
          borderColor: mode === "reply" ? "rgb(var(--hd-border))" : "rgba(245,158,11,0.3)",
          color: "rgb(var(--hd-text-primary))",
        }}
      />

      {/* Actions Bar */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <div className="relative" ref={macroDropdownRef}>
            <button
              type="button"
              onClick={() => setShowMacros(!showMacros)}
              className="px-3 py-1.5 text-sm rounded-md border hd-transition flex items-center gap-2"
              style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}
            >
              <span>⚡</span><span>Macros</span><span className="hd-kbd">⌘M</span>
            </button>

            {showMacros && (
              <div
                className="absolute bottom-full left-0 mb-2 w-80 border rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col z-50"
                style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}
              >
                <div className="p-2 border-b" style={{ borderColor: "rgb(var(--hd-border))" }}>
                  <input
                    type="text"
                    value={macroSearch}
                    onChange={(e) => setMacroSearch(e.target.value)}
                    placeholder="Search macros..."
                    className="w-full px-3 py-1.5 text-sm rounded-md border outline-none"
                    style={{ background: "rgb(var(--hd-bg-deep))", borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-primary))" }}
                    autoFocus
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-2 hd-scrollbar">
                  {Object.entries(groupedMacros).map(([category, items]) => (
                    <div key={category} className="mb-3 last:mb-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: "rgb(var(--hd-text-dim))" }}>{category}</div>
                      {items.map((macro) => {
                        const preview = macroContext
                          ? substituteMacroVariables(macro.body, macroContext)
                          : macro.body;
                        return (
                          <button key={macro.id} onClick={() => useMacro(macro)} className="w-full text-left px-3 py-2 rounded-md hd-transition">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>{macro.title}</span>
                              {macro.shortcut && <span className="hd-kbd">{macro.shortcut}</span>}
                            </div>
                            <div className="text-xs truncate mt-0.5" style={{ color: "rgb(var(--hd-text-muted))" }}>{preview.slice(0, 60)}...</div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {filteredMacros.length === 0 && (
                    <div className="text-center py-4 text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>No macros found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-md border hd-transition flex items-center gap-2"
            style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}
          >
            <span>📎</span><span>Attach</span>
          </button>

          <AiAssistDropdown
            body={body}
            onResult={(text) => { setBody(text); textareaRef.current?.focus(); }}
            assistEnabled={aiAssistEnabled}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!body.trim() || isSubmitting}
          className={cn(
            "px-4 py-2 text-sm font-semibold rounded-lg hd-transition flex items-center gap-2",
            mode === "reply" ? "bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-500/50" : "bg-amber-500 hover:bg-amber-600 text-white disabled:bg-amber-500/50",
            "disabled:cursor-not-allowed"
          )}
        >
          {isSubmitting ? (
            <><span className="animate-spin">⏳</span><span>Sending...</span></>
          ) : mode === "reply" ? (
            <><span>✈️</span><span>Send Reply</span><span className="text-xs opacity-70">⌘↵</span></>
          ) : (
            <><span>🔒</span><span>Add Note</span><span className="text-xs opacity-70">⌘↵</span></>
          )}
        </button>
      </div>
    </div>
  );
}
