"use client";

import { useState, useTransition, useRef } from "react";
import { Plus, Trash2, GripVertical, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import {
  toggleRoutingRule,
  reorderRoutingRules,
} from "@/lib/actions/helpdesk-agent";
import {
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
} from "@/lib/actions/helpdesk-manage";

type ConditionField = "type" | "channel" | "priority" | "subject" | "tags" | "requesterType";
type ConditionOperator = "eq" | "in" | "contains" | "gte" | "lte" | "startsWith";

interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

interface RuleAction {
  setPriority?: string;
  setCategory?: string;
}

interface RoutingRule {
  id: string;
  name: string;
  conditionsJson: unknown;
  actionsJson: unknown;
  sortOrder: number;
  isActive: boolean;
}

interface RoutingRuleListProps {
  rules: RoutingRule[];
}

const CONDITION_FIELDS: ConditionField[] = ["type", "channel", "priority", "subject", "tags", "requesterType"];
const CONDITION_OPERATORS: ConditionOperator[] = ["eq", "in", "contains", "gte", "lte", "startsWith"];

function blankCondition(): RuleCondition { return { field: "type", operator: "eq", value: "" }; }
function blankAction(): RuleAction { return {}; }

function ConditionRow({
  cond,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  cond: RuleCondition;
  index: number;
  onChange: (i: number, c: RuleCondition) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={cond.field}
        onChange={(e) => onChange(index, { ...cond, field: e.target.value as ConditionField })}
        className="rounded border px-2 py-1 text-xs"
        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}
      >
        {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <select
        value={cond.operator}
        onChange={(e) => onChange(index, { ...cond, operator: e.target.value as ConditionOperator })}
        className="rounded border px-2 py-1 text-xs"
        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}
      >
        {CONDITION_OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <input
        type="text"
        value={cond.value}
        onChange={(e) => onChange(index, { ...cond, value: e.target.value })}
        placeholder="value"
        className="flex-1 rounded border px-2 py-1 text-xs"
        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}
      />
      {canRemove && (
        <button type="button" onClick={() => onRemove(index)} className="text-red-500 hover:text-red-700">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function RuleForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: { name: string; conditions: RuleCondition[]; action: RuleAction };
  onSave: (name: string, conditions: RuleCondition[], action: RuleAction) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [conditions, setConditions] = useState<RuleCondition[]>(
    initial?.conditions && initial.conditions.length > 0 ? initial.conditions : [blankCondition()]
  );
  const [action, setAction] = useState<RuleAction>(initial?.action ?? blankAction());

  function updateCondition(i: number, c: RuleCondition) {
    setConditions((prev) => prev.map((x, idx) => (idx === i ? c : x)));
  }
  function removeCondition(i: number) {
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-lg border p-4 space-y-3"
      style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-card))" }}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Rule name"
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}
      />
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: "rgb(var(--hd-text-secondary))" }}>Conditions (all must match)</p>
        {conditions.map((c, i) => (
          <ConditionRow key={i} cond={c} index={i} onChange={updateCondition} onRemove={removeCondition} canRemove={conditions.length > 1} />
        ))}
        <button type="button" onClick={() => setConditions((p) => [...p, blankCondition()])}
          className="text-xs text-blue-500 hover:underline">+ Add condition</button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: "rgb(var(--hd-text-secondary))" }}>Action</p>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>Set priority:</span>
          <select value={action.setPriority ?? ""}
            onChange={(e) => setAction((p) => ({ ...p, setPriority: e.target.value || undefined }))}
            className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}>
            <option value="">— none —</option>
            {["CRITICAL", "URGENT", "HIGH", "NORMAL", "LOW"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>Set category:</span>
          <input type="text" value={action.setCategory ?? ""} onChange={(e) => setAction((p) => ({ ...p, setCategory: e.target.value || undefined }))}
            placeholder="optional" className="rounded border px-2 py-1 text-xs"
            style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => onSave(name, conditions, action)} disabled={isPending || !name.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {isPending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded border px-3 py-1.5 text-sm hd-transition"
          style={{ borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}>Cancel</button>
      </div>
    </div>
  );
}

export function RoutingRuleList({ rules: initial }: RoutingRuleListProps) {
  const [rules, setRules] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dragId = useRef<string | null>(null);

  function handleDragStart(id: string) { dragId.current = id; }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(targetId: string) {
    if (!dragId.current || dragId.current === targetId) return;
    const from = rules.findIndex((r) => r.id === dragId.current);
    const to = rules.findIndex((r) => r.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...rules];
    const spliced = next.splice(from, 1);
    const item = spliced[0];
    if (!item) return;
    next.splice(to, 0, item);
    setRules(next);
    dragId.current = null;
    startTransition(async () => {
      const result = await reorderRoutingRules(next.map((r) => r.id));
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save order');
      }
    });
  }

  function handleToggle(ruleId: string, current: boolean) {
    startTransition(async () => {
      const result = await toggleRoutingRule(ruleId, !current);
      if (result.success) {
        setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, isActive: !current } : r));
      } else {
        toast.error(result.error ?? 'Failed to toggle rule');
      }
    });
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      const result = await deleteRoutingRule(ruleId);
      if (result.success) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
      } else {
        toast.error(result.error ?? 'Failed to delete rule');
      }
    });
  }

  function handleCreate(name: string, conditions: RuleCondition[], action: RuleAction) {
    startTransition(async () => {
      const result = await createRoutingRule({ name, conditionsJson: conditions, actionsJson: action });
      if (result.success && result.data) {
        setRules((prev) => [...prev, { id: result.data!.id, name, conditionsJson: conditions, actionsJson: action, sortOrder: prev.length, isActive: true }]);
        setShowCreate(false);
      } else {
        toast.error(result.error ?? 'Failed to create rule');
      }
    });
  }

  function handleUpdate(ruleId: string, name: string, conditions: RuleCondition[], action: RuleAction) {
    startTransition(async () => {
      const result = await updateRoutingRule({ ruleId, name, conditionsJson: conditions, actionsJson: action });
      if (result.success) {
        setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, name, conditionsJson: conditions, actionsJson: action } : r));
        setEditingId(null);
      } else {
        toast.error(result.error ?? 'Failed to update rule');
      }
    });
  }

  function getEditInitial(rule: RoutingRule) {
    const conds = Array.isArray(rule.conditionsJson) ? (rule.conditionsJson as RuleCondition[]) : [blankCondition()];
    const act = (rule.actionsJson && typeof rule.actionsJson === "object") ? (rule.actionsJson as RuleAction) : blankAction();
    return { name: rule.name, conditions: conds, action: act };
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Rule
        </button>
      </div>
      {showCreate && (
        <RuleForm onSave={handleCreate} onCancel={() => setShowCreate(false)} isPending={isPending} />
      )}
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div key={rule.id}>
            {editingId === rule.id ? (
              <RuleForm
                initial={getEditInitial(rule)}
                onSave={(n, c, a) => handleUpdate(rule.id, n, c, a)}
                onCancel={() => setEditingId(null)}
                isPending={isPending}
              />
            ) : (
              <div
                draggable
                onDragStart={() => handleDragStart(rule.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(rule.id)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-grab ${rule.isActive ? "" : "opacity-50"}`}
                style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-card))" }}
              >
                <GripVertical className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--hd-text-dim))" }} />
                <span className="text-xs w-5 text-center" style={{ color: "rgb(var(--hd-text-dim))" }}>{index + 1}</span>
                <span className="flex-1 text-sm font-medium" style={{ color: "rgb(var(--hd-text-primary))" }}>{rule.name}</span>
                <button type="button" onClick={() => handleToggle(rule.id, rule.isActive)} disabled={isPending}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {rule.isActive ? "Active" : "Inactive"}
                </button>
                <button type="button" onClick={() => setEditingId(rule.id)} disabled={isPending}
                  className="p-1 rounded hover:bg-blue-500/10 text-blue-500" aria-label="Edit rule">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => handleDelete(rule.id)} disabled={isPending}
                  className="p-1 rounded hover:bg-red-500/10 text-red-500" aria-label="Delete rule">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {rules.length === 0 && !showCreate && (
        <div className="rounded-lg border border-dashed p-12 text-center"
          style={{ borderColor: "rgb(var(--hd-border))" }}>
          <p className="text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>No routing rules. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
