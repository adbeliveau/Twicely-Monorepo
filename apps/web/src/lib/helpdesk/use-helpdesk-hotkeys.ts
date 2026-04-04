"use client";

import { useEffect, useRef } from "react";

// =============================================================================
// HELPDESK HOTKEYS HOOK
// Registers workspace keyboard shortcuts per canonical §6.2.
// Shortcuts are only active when NOT focused on form elements.
// Cmd/Ctrl+Shift+R fires even inside inputs.
// =============================================================================

interface HotkeyHandlers {
  navigatePrev: () => void;
  navigateNext: () => void;
  focusReply: () => void;
  focusNote: () => void;
  escalate: () => void;
  toggleMacros: () => void;
  toggleShortcutHelp: () => void;
  resolve: () => void;
  setPriority: (p: string) => void;
}

export function useHelpdeskHotkeys(handlers: HotkeyHandlers): void {
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      // Cmd/Ctrl+Shift+R — resolve (fires even in inputs per canonical §6.2)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "r") {
        e.preventDefault();
        h.resolve();
        return;
      }

      // Skip single-key shortcuts when focused on form elements
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (target.isContentEditable) return;

      switch (e.key) {
        case "[": case "ArrowLeft": h.navigatePrev(); break;
        case "]": case "ArrowRight": h.navigateNext(); break;
        case "r": h.focusReply(); break;
        case "n": h.focusNote(); break;
        case "e": h.escalate(); break;
        case "m": h.toggleMacros(); break;
        case "?": h.toggleShortcutHelp(); break;
        case "1": h.setPriority("CRITICAL"); break;
        case "2": h.setPriority("URGENT"); break;
        case "3": h.setPriority("HIGH"); break;
        case "4": h.setPriority("NORMAL"); break;
        case "5": h.setPriority("LOW"); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
