"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Shift+R — resolve (fires even in inputs per canonical §6.2)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "r") {
        e.preventDefault();
        handlers.resolve();
        return;
      }

      // Skip single-key shortcuts when focused on form elements
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (target.isContentEditable) return;

      switch (e.key) {
        case "[": case "ArrowLeft": handlers.navigatePrev(); break;
        case "]": case "ArrowRight": handlers.navigateNext(); break;
        case "r": handlers.focusReply(); break;
        case "n": handlers.focusNote(); break;
        case "e": handlers.escalate(); break;
        case "m": handlers.toggleMacros(); break;
        case "?": handlers.toggleShortcutHelp(); break;
        case "1": handlers.setPriority("CRITICAL"); break;
        case "2": handlers.setPriority("URGENT"); break;
        case "3": handlers.setPriority("HIGH"); break;
        case "4": handlers.setPriority("NORMAL"); break;
        case "5": handlers.setPriority("LOW"); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers]);
}
