"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, BookOpen, Eye, EyeOff, Pencil } from "lucide-react";
import { createMacro, deleteMacro } from "@/lib/actions/helpdesk-agent";
import { updateMacro } from "@/lib/actions/helpdesk-manage";

interface MacroRow {
  id: string;
  name: string;
  description: string | null;
  bodyTemplate: string;
  isShared: boolean;
  usageCount: number;
  createdByStaffId: string;
  createdAt: Date;
}

interface MacroListProps {
  macros: MacroRow[];
}

const TEMPLATE_VARS = [
  "{{buyer_name}}", "{{case_number}}", "{{order_number}}",
  "{{agent_name}}", "{{listing_title}}", "{{seller_name}}", "{{return_status}}",
];

export function MacroList({ macros }: MacroListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [isShared, setIsShared] = useState(true);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editIsShared, setEditIsShared] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    if (!name.trim() || !bodyTemplate.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createMacro({
        name: name.trim(),
        description: description.trim() || undefined,
        bodyTemplate: bodyTemplate.trim(),
        isShared,
      });
      if (result.success) {
        setName("");
        setDescription("");
        setBodyTemplate("");
        setShowForm(false);
      } else {
        setError(result.error ?? "Failed to create macro");
      }
    });
  }

  function handleDelete(macroId: string) {
    startTransition(async () => {
      await deleteMacro(macroId);
    });
  }

  function startEdit(macro: MacroRow) {
    setEditingId(macro.id);
    setEditName(macro.name);
    setEditDescription(macro.description ?? "");
    setEditBody(macro.bodyTemplate);
    setEditIsShared(macro.isShared);
  }

  function handleUpdate() {
    if (!editingId || !editName.trim() || !editBody.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await updateMacro({
        macroId: editingId,
        name: editName.trim(),
        description: editDescription.trim() || null,
        bodyTemplate: editBody.trim(),
        isShared: editIsShared,
      });
      if (result.success) {
        setEditingId(null);
      } else {
        setError(result.error ?? "Failed to update macro");
      }
    });
  }

  if (macros.length === 0 && !showForm) {
    return (
      <>
        <div className="rounded-lg border border-dashed p-12 text-center"
          style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-card))" }}>
          <BookOpen className="mx-auto h-8 w-8" style={{ color: "rgb(var(--hd-text-dim))" }} />
          <p className="mt-3 text-sm font-medium" style={{ color: "rgb(var(--hd-text-secondary))" }}>
            No macros yet
          </p>
          <p className="mt-1 text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>
            Create macros to speed up common replies with template variables.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create First Macro
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Macro
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 space-y-3"
          style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-card))" }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Macro name"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}
          />
          <textarea
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            placeholder="Template body — use {{buyer_name}}, {{order_number}} etc."
            rows={4}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none resize-y"
            style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}
          />
          <p className="text-[10px]" style={{ color: "rgb(var(--hd-text-dim))" }}>
            Variables: {TEMPLATE_VARS.join(" ")}
          </p>
          <label className="flex items-center gap-2 text-sm" style={{ color: "rgb(var(--hd-text-secondary))" }}>
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
            Shared with all agents
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || !name.trim() || !bodyTemplate.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create Macro"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border px-4 py-2 text-sm hd-transition"
              style={{ borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {macros.map((macro) => (
          <div key={macro.id} className="rounded-lg border"
            style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-card))" }}>
            {editingId === macro.id ? (
              <div className="p-4 space-y-3">
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Macro name"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
                <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description (optional)"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none resize-y"
                  style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
                <p className="text-[10px]" style={{ color: "rgb(var(--hd-text-dim))" }}>
                  Variables: {TEMPLATE_VARS.join(" ")}
                </p>
                <label className="flex items-center gap-2 text-sm" style={{ color: "rgb(var(--hd-text-secondary))" }}>
                  <input type="checkbox" checked={editIsShared} onChange={(e) => setEditIsShared(e.target.checked)} />
                  Shared with all agents
                </label>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={handleUpdate}
                    disabled={isPending || !editName.trim() || !editBody.trim()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {isPending ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)}
                    className="rounded-md border px-4 py-2 text-sm hd-transition"
                    style={{ borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>
                      {macro.name}
                    </h3>
                    {macro.isShared ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                        <Eye className="h-3 w-3" /> Shared
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500">
                        <EyeOff className="h-3 w-3" /> Personal
                      </span>
                    )}
                  </div>
                  {macro.description && (
                    <p className="text-xs mt-0.5" style={{ color: "rgb(var(--hd-text-muted))" }}>
                      {macro.description}
                    </p>
                  )}
                  <pre className="mt-2 text-xs whitespace-pre-wrap rounded px-2 py-1.5 max-h-24 overflow-hidden"
                    style={{ background: "rgb(var(--hd-bg-deep))", color: "rgb(var(--hd-text-secondary))" }}>
                    {macro.bodyTemplate.slice(0, 200)}{macro.bodyTemplate.length > 200 ? "..." : ""}
                  </pre>
                  <div className="mt-2 text-[10px]" style={{ color: "rgb(var(--hd-text-dim))" }}>
                    Used {macro.usageCount} times
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => startEdit(macro)} disabled={isPending}
                    className="p-1.5 rounded-md text-blue-500 hover:bg-blue-500/10 hd-transition disabled:opacity-50"
                    aria-label={`Edit macro ${macro.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDelete(macro.id)} disabled={isPending}
                    className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 hd-transition disabled:opacity-50"
                    aria-label={`Delete macro ${macro.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
