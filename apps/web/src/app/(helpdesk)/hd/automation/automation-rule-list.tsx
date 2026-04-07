"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { toggleAutomationRule } from "@/lib/actions/helpdesk-agent";
import {
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
} from "@/lib/actions/helpdesk-manage";

type TriggerEvent =
  | "CASE_CREATED" | "STATUS_CHANGED" | "PRIORITY_CHANGED"
  | "SLA_WARNING" | "SLA_BREACHED" | "NO_RESPONSE"
  | "AGENT_ASSIGNED" | "MESSAGE_RECEIVED" | "CASE_REOPENED";

type ActionType =
  | "SET_PRIORITY" | "ASSIGN_TEAM" | "ASSIGN_AGENT"
  | "ADD_TAGS" | "REMOVE_TAGS" | "SET_STATUS"
  | "SEND_NOTIFICATION" | "ADD_NOTE";

interface AutoCondition {
  field: string;
  operator: "eq" | "in" | "gte" | "lte" | "contains";
  value: string;
}

interface AutoAction {
  type: ActionType;
  value: string;
}

interface AutomationRule {
  id: string;
  name: string;
  triggerEvent: string;
  conditionsJson: unknown;
  actionsJson: unknown;
  sortOrder: number;
  isActive: boolean;
}

interface AutomationRuleListProps {
  rules: AutomationRule[];
}

const TRIGGER_EVENTS: TriggerEvent[] = [
  "CASE_CREATED", "STATUS_CHANGED", "PRIORITY_CHANGED",
  "SLA_WARNING", "SLA_BREACHED", "NO_RESPONSE",
  "AGENT_ASSIGNED", "MESSAGE_RECEIVED", "CASE_REOPENED",
];

const ACTION_TYPES: ActionType[] = [
  "SET_PRIORITY", "ASSIGN_TEAM", "ASSIGN_AGENT",
  "ADD_TAGS", "REMOVE_TAGS", "SET_STATUS",
  "SEND_NOTIFICATION", "ADD_NOTE",
];

const OPERATORS = ["eq", "in", "gte", "lte", "contains"] as const;

function blankCondition(): AutoCondition {
  return { field: "status", operator: "eq", value: "" };
}

function blankAction(): AutoAction {
  return { type: "SET_PRIORITY", value: "" };
}

function RuleForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: { name: string; trigger: TriggerEvent; conditions: AutoCondition[]; actions: AutoAction[] };
  onSave: (name: string, trigger: TriggerEvent, conditions: AutoCondition[], actions: AutoAction[]) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [trigger, setTrigger] = useState<TriggerEvent>(initial?.trigger ?? "CASE_CREATED");
  const [conditions, setConditions] = useState<AutoCondition[]>(initial?.conditions ?? []);
  const [actions, setActions] = useState<AutoAction[]>(
    initial?.actions && initial.actions.length > 0 ? initial.actions : [blankAction()]
  );

  function updateCond(i: number, c: AutoCondition) {
    setConditions((prev) => prev.map((x, idx) => (idx === i ? c : x)));
  }
  function updateAction(i: number, a: AutoAction) {
    setActions((prev) => prev.map((x, idx) => (idx === i ? a : x)));
  }

  return (
    <div className="rounded-lg border p-4 space-y-3"
      style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-card))" }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name"
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: "rgb(var(--hd-text-secondary))" }}>Trigger event</label>
        <select value={trigger} onChange={(e) => setTrigger(e.target.value as TriggerEvent)}
          className="w-full rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}>
          {TRIGGER_EVENTS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: "rgb(var(--hd-text-secondary))" }}>Conditions (optional)</p>
        {conditions.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="text" value={c.field} onChange={(e) => updateCond(i, { ...c, field: e.target.value })}
              placeholder="field" className="rounded border px-2 py-1 text-xs w-24"
              style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
            <select value={c.operator} onChange={(e) => updateCond(i, { ...c, operator: e.target.value as typeof c.operator })}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}>
              {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input type="text" value={c.value} onChange={(e) => updateCond(i, { ...c, value: e.target.value })}
              placeholder="value" className="flex-1 rounded border px-2 py-1 text-xs"
              style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
            <button type="button" onClick={() => setConditions((p) => p.filter((_, idx) => idx !== i))} className="text-red-500">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setConditions((p) => [...p, blankCondition()])}
          className="text-xs text-brand-500 hover:underline">+ Add condition</button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: "rgb(var(--hd-text-secondary))" }}>Actions (at least 1 required)</p>
        {actions.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={a.type} onChange={(e) => updateAction(i, { ...a, type: e.target.value as ActionType })}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}>
              {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" value={a.value} onChange={(e) => updateAction(i, { ...a, value: e.target.value })}
              placeholder="value" className="flex-1 rounded border px-2 py-1 text-xs"
              style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
            {actions.length > 1 && (
              <button type="button" onClick={() => setActions((p) => p.filter((_, idx) => idx !== i))} className="text-red-500">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setActions((p) => [...p, blankAction()])}
          className="text-xs text-brand-500 hover:underline">+ Add action</button>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => onSave(name, trigger, conditions, actions)}
          disabled={isPending || !name.trim() || actions.length === 0}
          className="rounded bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
          {isPending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded border px-3 py-1.5 text-sm hd-transition"
          style={{ borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}>Cancel</button>
      </div>
    </div>
  );
}

export function AutomationRuleList({ rules: initial }: AutomationRuleListProps) {
  const [rules, setRules] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(ruleId: string, current: boolean) {
    startTransition(async () => {
      const result = await toggleAutomationRule(ruleId, !current);
      if (result.success) {
        setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, isActive: !current } : r));
      } else {
        toast.error(result.error ?? 'Failed to toggle rule');
      }
    });
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      const result = await deleteAutomationRule(ruleId);
      if (result.success) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
      } else {
        toast.error(result.error ?? 'Failed to delete rule');
      }
    });
  }

  function handleCreate(name: string, trigger: TriggerEvent, conditions: AutoCondition[], actions: AutoAction[]) {
    startTransition(async () => {
      const result = await createAutomationRule({ name, triggerEvent: trigger, conditionsJson: conditions, actionsJson: actions });
      if (result.success && result.data) {
        setRules((prev) => [...prev, { id: result.data!.id, name, triggerEvent: trigger, conditionsJson: conditions, actionsJson: actions, sortOrder: prev.length, isActive: true }]);
        setShowCreate(false);
      } else {
        toast.error(result.error ?? 'Failed to create rule');
      }
    });
  }

  function handleUpdate(ruleId: string, name: string, trigger: TriggerEvent, conditions: AutoCondition[], actions: AutoAction[]) {
    startTransition(async () => {
      const result = await updateAutomationRule({ ruleId, name, triggerEvent: trigger, conditionsJson: conditions, actionsJson: actions });
      if (result.success) {
        setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, name, triggerEvent: trigger, conditionsJson: conditions, actionsJson: actions } : r));
        setEditingId(null);
      } else {
        toast.error(result.error ?? 'Failed to update rule');
      }
    });
  }

  function getEditInitial(rule: AutomationRule) {
    const conds = Array.isArray(rule.conditionsJson) ? (rule.conditionsJson as AutoCondition[]) : [];
    const acts = Array.isArray(rule.actionsJson) ? (rule.actionsJson as AutoAction[]) : [blankAction()];
    return { name: rule.name, trigger: rule.triggerEvent as TriggerEvent, conditions: conds, actions: acts };
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> New Rule
        </button>
      </div>
      {showCreate && (
        <RuleForm onSave={handleCreate} onCancel={() => setShowCreate(false)} isPending={isPending} />
      )}
      {rules.length === 0 && !showCreate ? (
        <div className="rounded-lg border border-dashed p-12 text-center"
          style={{ borderColor: "rgb(var(--hd-border))" }}>
          <p className="text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>No automation rules. Create one to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "rgb(var(--hd-border))" }}>
          <table className="min-w-full divide-y text-sm" style={{ borderColor: "rgb(var(--hd-border))" }}>
            <thead style={{ background: "rgb(var(--hd-bg-panel))" }}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--hd-text-muted))" }}>Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--hd-text-muted))" }}>Trigger</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: "rgb(var(--hd-text-muted))" }}>Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody style={{ background: "rgb(var(--hd-bg-card))" }}>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td colSpan={editingId === rule.id ? 4 : 1} className="px-4 py-3">
                    {editingId === rule.id ? (
                      <RuleForm
                        initial={getEditInitial(rule)}
                        onSave={(n, t, c, a) => handleUpdate(rule.id, n, t, c, a)}
                        onCancel={() => setEditingId(null)}
                        isPending={isPending}
                      />
                    ) : (
                      <span className="font-medium" style={{ color: "rgb(var(--hd-text-primary))" }}>{rule.name}</span>
                    )}
                  </td>
                  {editingId !== rule.id && (
                    <>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "rgb(var(--hd-text-secondary))" }}>{rule.triggerEvent}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => handleToggle(rule.id, rule.isActive)} disabled={isPending}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {rule.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button type="button" onClick={() => setEditingId(rule.id)} disabled={isPending}
                            className="p-1 rounded text-brand-500 hover:bg-brand-500/10" aria-label="Edit rule">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDelete(rule.id)} disabled={isPending}
                            className="p-1 rounded text-red-500 hover:bg-red-500/10" aria-label="Delete rule">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
