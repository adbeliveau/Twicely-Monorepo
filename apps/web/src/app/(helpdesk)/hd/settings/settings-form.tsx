"use client";

import { useState, useTransition } from "react";
import { updateHelpdeskSetting } from "@/lib/actions/helpdesk-manage";

interface SettingRow {
  key: string;
  value: unknown;
}

interface SettingsFormProps {
  settings: SettingRow[];
}

function useSetting(settings: SettingRow[], key: string): unknown {
  return settings.find((s) => s.key === key)?.value;
}

export function HelpdeskSettingsForm({ settings: initial }: SettingsFormProps) {
  const [settings, setSettings] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [editSection, setEditSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Business hours state
  const [bhStart, setBhStart] = useState(String(useSetting(settings, "helpdesk.businessHours.start") ?? "09:00"));
  const [bhEnd, setBhEnd] = useState(String(useSetting(settings, "helpdesk.businessHours.end") ?? "18:00"));
  const [bhTimezone, setBhTimezone] = useState(String(useSetting(settings, "helpdesk.businessHours.timezone") ?? "America/New_York"));

  // Auto-close state
  const [pendingDays, setPendingDays] = useState(Number(useSetting(settings, "helpdesk.autoClose.pendingUserDays") ?? 14));
  const [resolvedDays, setResolvedDays] = useState(Number(useSetting(settings, "helpdesk.autoClose.resolvedDays") ?? 7));
  const [reopenDays, setReopenDays] = useState(Number(useSetting(settings, "helpdesk.reopen.windowDays") ?? 7));

  // CSAT & routing state
  const [csatEnabled, setCsatEnabled] = useState(Boolean(useSetting(settings, "helpdesk.csat.enabled") ?? true));
  const [roundRobin, setRoundRobin] = useState(Boolean(useSetting(settings, "helpdesk.roundRobin.enabled") ?? true));
  const [csatDelay, setCsatDelay] = useState(Number(useSetting(settings, "helpdesk.csat.surveyDelayMinutes") ?? 30));

  async function saveSetting(key: string, value: unknown) {
    const result = await updateHelpdeskSetting({ key, value });
    if (!result.success) {
      setError(result.error ?? "Failed to save");
      return false;
    }
    setSettings((prev) => prev.map((s) => s.key === key ? { ...s, value } : s));
    return true;
  }

  function handleSaveBusinessHours() {
    setError(null);
    startTransition(async () => {
      const ok1 = await saveSetting("helpdesk.businessHours.start", bhStart);
      const ok2 = await saveSetting("helpdesk.businessHours.end", bhEnd);
      const ok3 = await saveSetting("helpdesk.businessHours.timezone", bhTimezone);
      if (ok1 && ok2 && ok3) setEditSection(null);
    });
  }

  function handleSaveAutoClose() {
    setError(null);
    startTransition(async () => {
      const ok1 = await saveSetting("helpdesk.autoClose.pendingUserDays", pendingDays);
      const ok2 = await saveSetting("helpdesk.autoClose.resolvedDays", resolvedDays);
      const ok3 = await saveSetting("helpdesk.reopen.windowDays", reopenDays);
      if (ok1 && ok2 && ok3) setEditSection(null);
    });
  }

  function handleSaveCsat() {
    setError(null);
    startTransition(async () => {
      const ok1 = await saveSetting("helpdesk.csat.enabled", csatEnabled);
      const ok2 = await saveSetting("helpdesk.roundRobin.enabled", roundRobin);
      const ok3 = await saveSetting("helpdesk.csat.surveyDelayMinutes", csatDelay);
      if (ok1 && ok2 && ok3) setEditSection(null);
    });
  }

  const TIMEZONES = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Sydney",
    "UTC",
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Business Hours */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Business Hours</h2>
          {editSection !== "bh" ? (
            <button type="button" onClick={() => setEditSection("bh")}
              className="text-xs text-blue-500 hover:underline">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={handleSaveBusinessHours} disabled={isPending}
                className="text-xs text-blue-600 font-medium hover:underline disabled:opacity-50">
                {isPending ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => setEditSection(null)}
                className="text-xs text-gray-500 hover:underline">Cancel</button>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-gray-600">Start</span>
            {editSection === "bh" ? (
              <input type="time" value={bhStart} onChange={(e) => setBhStart(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm" />
            ) : (
              <span className="font-medium text-gray-900">{bhStart}</span>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-gray-600">End</span>
            {editSection === "bh" ? (
              <input type="time" value={bhEnd} onChange={(e) => setBhEnd(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm" />
            ) : (
              <span className="font-medium text-gray-900">{bhEnd}</span>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-gray-600">Timezone</span>
            {editSection === "bh" ? (
              <select value={bhTimezone} onChange={(e) => setBhTimezone(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm">
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            ) : (
              <span className="font-medium text-gray-900">{bhTimezone}</span>
            )}
          </div>
        </div>
      </section>

      {/* Auto-Close */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Auto-Close</h2>
          {editSection !== "ac" ? (
            <button type="button" onClick={() => setEditSection("ac")}
              className="text-xs text-blue-500 hover:underline">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={handleSaveAutoClose} disabled={isPending}
                className="text-xs text-blue-600 font-medium hover:underline disabled:opacity-50">
                {isPending ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => setEditSection(null)}
                className="text-xs text-gray-500 hover:underline">Cancel</button>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-gray-600">Close PENDING_USER after</span>
            {editSection === "ac" ? (
              <div className="flex items-center gap-1">
                <input type="number" value={pendingDays} onChange={(e) => setPendingDays(Number(e.target.value))} min={1} max={90}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm" />
                <span className="text-gray-500 text-xs">days</span>
              </div>
            ) : (
              <span className="font-medium text-gray-900">{pendingDays} days</span>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-gray-600">Close RESOLVED after</span>
            {editSection === "ac" ? (
              <div className="flex items-center gap-1">
                <input type="number" value={resolvedDays} onChange={(e) => setResolvedDays(Number(e.target.value))} min={1} max={90}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm" />
                <span className="text-gray-500 text-xs">days</span>
              </div>
            ) : (
              <span className="font-medium text-gray-900">{resolvedDays} days</span>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-gray-600">Reopen window</span>
            {editSection === "ac" ? (
              <div className="flex items-center gap-1">
                <input type="number" value={reopenDays} onChange={(e) => setReopenDays(Number(e.target.value))} min={1} max={90}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm" />
                <span className="text-gray-500 text-xs">days</span>
              </div>
            ) : (
              <span className="font-medium text-gray-900">{reopenDays} days</span>
            )}
          </div>
        </div>
      </section>

      {/* CSAT & Routing */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">CSAT & Routing</h2>
          {editSection !== "csat" ? (
            <button type="button" onClick={() => setEditSection("csat")}
              className="text-xs text-blue-500 hover:underline">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={handleSaveCsat} disabled={isPending}
                className="text-xs text-blue-600 font-medium hover:underline disabled:opacity-50">
                {isPending ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => setEditSection(null)}
                className="text-xs text-gray-500 hover:underline">Cancel</button>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-gray-600">CSAT surveys</span>
            {editSection === "csat" ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={csatEnabled} onChange={(e) => setCsatEnabled(e.target.checked)} />
                <span className="text-xs text-gray-600">Enabled</span>
              </label>
            ) : (
              <span className={`font-medium ${csatEnabled ? "text-green-600" : "text-gray-400"}`}>
                {csatEnabled ? "Enabled" : "Disabled"}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-gray-600">Round-robin assignment</span>
            {editSection === "csat" ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={roundRobin} onChange={(e) => setRoundRobin(e.target.checked)} />
                <span className="text-xs text-gray-600">Enabled</span>
              </label>
            ) : (
              <span className={`font-medium ${roundRobin ? "text-green-600" : "text-gray-400"}`}>
                {roundRobin ? "Enabled" : "Disabled"}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-gray-600">CSAT survey delay</span>
            {editSection === "csat" ? (
              <div className="flex items-center gap-1">
                <input type="number" value={csatDelay} onChange={(e) => setCsatDelay(Number(e.target.value))} min={0}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm" />
                <span className="text-gray-500 text-xs">minutes</span>
              </div>
            ) : (
              <span className="font-medium text-gray-900">{csatDelay} minutes</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
