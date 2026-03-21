"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// =============================================================================
// KEYBOARD SHORTCUTS MODAL
// =============================================================================

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const DEFAULT_SHORTCUTS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: "J / K", description: "Next / Previous case" },
      { keys: "⌘K", description: "Search cases" },
      { keys: "G then D", description: "Go to Dashboard" },
      { keys: "G then Q", description: "Go to Queue" },
    ],
  },
  {
    title: "Case Actions",
    shortcuts: [
      { keys: "⌘↵", description: "Send reply / note" },
      { keys: "⌘I", description: "Toggle internal note" },
      { keys: "⌘M", description: "Open macros" },
      { keys: "⌘E", description: "Escalate case" },
      { keys: "⌘R", description: "Resolve case" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { keys: "?", description: "Show shortcuts" },
      { keys: "Esc", description: "Close modal / Cancel" },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-6">
          {DEFAULT_SHORTCUTS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{group.title}</h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{shortcut.description}</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB BAR
// =============================================================================

interface Tab {
  label: string;
  href?: string;
  onClick?: () => void;
  count?: number;
  isActive?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  className?: string;
}

export function TabBar({ tabs, className }: TabBarProps) {
  return (
    <div className={cn("flex items-center gap-0 px-4 bg-white dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800", className)}>
      {tabs.map((tab, index) => {
        const sharedClassName = cn(
          "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
          tab.isActive
            ? "text-blue-600 dark:text-blue-400 border-blue-500"
            : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
        );
        const content = (
          <>
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={cn("px-1.5 py-0.5 text-[10px] font-bold rounded-full", tab.isActive ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>
                {tab.count}
              </span>
            )}
          </>
        );
        if (tab.href) {
          return <Link key={index} href={tab.href} className={sharedClassName}>{content}</Link>;
        }
        return <button key={index} onClick={tab.onClick} className={sharedClassName}>{content}</button>;
      })}
    </div>
  );
}
