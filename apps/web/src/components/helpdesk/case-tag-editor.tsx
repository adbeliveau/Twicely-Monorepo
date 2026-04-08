"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { updateCaseTags } from "@/lib/actions/helpdesk-agent-cases-meta";

interface CaseTagEditorProps {
  caseId: string;
  tags: string[];
  isClosed?: boolean;
}

/**
 * Inline tag editor in case header — V2 pattern.
 * Tags render as pills with × button. "+ Add tag" reveals inline input.
 * Uses existing updateCaseTags server action (replace-all).
 */
export function CaseTagEditor({ caseId, tags: initialTags, isClosed = false }: CaseTagEditorProps) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external tags prop changes (e.g., after router.refresh())
  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  function commitTags(next: string[]) {
    setError(null);
    const previous = tags;
    setTags(next); // optimistic
    startTransition(async () => {
      const result = await updateCaseTags({ caseId, tags: next });
      if (!result.success) {
        setTags(previous); // rollback
        setError(result.error ?? "Failed to update tags");
      } else {
        router.refresh();
      }
    });
  }

  function handleAdd() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setIsAdding(false);
      setDraft("");
      return;
    }
    if (tags.includes(trimmed)) {
      setError("Tag already exists");
      return;
    }
    commitTags([...tags, trimmed]);
    setDraft("");
    setIsAdding(false);
  }

  function handleRemove(tag: string) {
    commitTags(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsAdding(false);
      setDraft("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px]" style={{ color: "rgb(var(--hd-text-dim))" }}>Tags</span>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] hd-transition"
          style={{
            background: "rgb(var(--hd-bg-hover))",
            color: "rgb(var(--hd-text-secondary))",
          }}
        >
          <span>{tag}</span>
          {!isClosed && (
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              disabled={isPending}
              className="rounded-full p-0.5 hover:bg-black/10 disabled:opacity-50"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}

      {!isClosed && (
        isAdding ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleAdd}
            placeholder="Add tag..."
            disabled={isPending}
            className="rounded-full border px-2 py-0.5 text-[11px] outline-none hd-transition"
            style={{
              background: "rgb(var(--hd-bg-card))",
              borderColor: "rgb(var(--hd-border))",
              color: "rgb(var(--hd-text-primary))",
              minWidth: 80,
              maxWidth: 140,
            }}
            maxLength={32}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            disabled={isPending}
            className="inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-[11px] hd-transition hover:opacity-80 disabled:opacity-50"
            style={{
              borderColor: "rgb(var(--hd-border))",
              color: "rgb(var(--hd-text-muted))",
            }}
            title="Add tag"
          >
            <Plus className="h-2.5 w-2.5" />
            <span>Add</span>
          </button>
        )
      )}

      {isPending && <span className="text-[10px]" style={{ color: "rgb(var(--hd-text-dim))" }}>saving…</span>}
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}
