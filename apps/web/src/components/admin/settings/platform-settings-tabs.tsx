'use client';

import { useState, useTransition } from 'react';
import { updatePlatformSetting } from '@/lib/actions/admin-settings';
import { getLabel, formatValue, toInputValue, fromInputValue, getInputPrefix, getInputSuffix } from './settings-display';
import { getHelpText } from './settings-help';
import { TAB_SECTIONS, isExcludedKey, type SectionDef } from './settings-sections';
import { TierTable } from './settings-tier-table';
import { SettingHistoryDrawer } from './setting-history-drawer';

interface SettingItem {
  id: string; key: string; value: unknown; type: string;
  description: string | null; isSecret: boolean;
}

interface Props {
  grouped: Record<string, SettingItem[]>;
  categories: string[];
  canEdit: boolean;
  initialSearch?: string;
}

const TAB_LABELS: Record<string, string> = {
  general: 'General', environment: 'Environment', integrations: 'Integrations',
  fees: 'Fees & Pricing', commerce: 'Commerce', fulfillment: 'Fulfillment',
  trust: 'Trust & Quality', discovery: 'Discovery', comms: 'Communications',
  payments: 'Payments', privacy: 'Privacy',
};

function HelpTip({ text }: { text: string }) {
  return (
    <div className="group/tip relative inline-flex">
      <span className="flex h-[18px] w-[18px] cursor-help items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-400 select-none hover:border-blue-400 hover:text-blue-500">
        ?
      </span>
      <div className="pointer-events-none absolute right-0 bottom-full z-50 mb-2 hidden w-72 rounded-lg bg-gray-900 px-3 py-2.5 text-xs leading-relaxed text-white shadow-lg group-hover/tip:block">
        {text}
        <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
}

function SettingRow({ setting, canEdit }: { setting: SettingItem; canEdit: boolean }) {
  const label = getLabel(setting.key);
  const help = getHelpText(setting.key);
  const isBool = setting.type === 'boolean' || typeof setting.value === 'boolean';
  const [editing, setEditing] = useState(false);
  const [textVal, setTextVal] = useState('');
  const [checked, setChecked] = useState(setting.value === true);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setTextVal(toInputValue(setting.value, setting.type, setting.key));
    setEditing(true); setSaved(false);
  }
  function handleSave() {
    startTransition(async () => {
      await updatePlatformSetting(setting.id, fromInputValue(textVal, setting.type, setting.key));
      setEditing(false); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }
  function handleToggle() {
    const next = !checked; setChecked(next);
    startTransition(async () => {
      await updatePlatformSetting(setting.id, next);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    });
  }

  const prefix = getInputPrefix(setting.type, setting.key);
  const suffix = getInputSuffix(setting.type, setting.key);

  // Left side: label + description subtitle
  const leftSide = (
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {setting.description && <p className="text-xs text-gray-500">{setting.description}</p>}
    </div>
  );

  if (setting.isSecret) {
    return (
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0">
        {leftSide}
        <div className="flex items-center gap-2">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Encrypted</span>
          {help && <HelpTip text={help} />}
        </div>
      </div>
    );
  }

  if (isBool) {
    return (
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0">
        {leftSide}
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-600">Saved</span>}
          <button type="button" role="switch" aria-checked={checked}
            disabled={!canEdit || isPending} onClick={handleToggle}
            className={['relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
              checked ? 'bg-gray-900' : 'bg-gray-200',
              (!canEdit || isPending) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'].join(' ')}>
            <span className={['inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-4' : 'translate-x-0'].join(' ')} />
          </button>
          {help && <HelpTip text={help} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0">
      {leftSide}
      <div className="flex shrink-0 items-center gap-2">
        {saved && <span className="text-xs text-green-600">Saved</span>}
        {editing ? (
          <>
            <div className="flex items-center gap-1">
              {prefix && <span className="text-sm text-gray-500">{prefix}</span>}
              <input type="text" value={textVal} onChange={(e) => setTextVal(e.target.value)}
                autoFocus disabled={isPending}
                className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50" />
              {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
            </div>
            <button type="button" onClick={handleSave} disabled={isPending}
              className="rounded bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50">
              {isPending ? '...' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(false)} disabled={isPending}
              className="rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">
              Cancel</button>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-gray-700">
              {formatValue(setting.value, setting.type, setting.key)}
            </span>
            {canEdit && (
              <button type="button" onClick={startEdit}
                className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-200">Edit</button>
            )}
            <SettingHistoryDrawer settingId={setting.id} settingKey={setting.key} />
          </>
        )}
        {help && <HelpTip text={help} />}
      </div>
    </div>
  );
}

function SectionBlock({ section, allSettings, byKey, canEdit }: {
  section: SectionDef;
  allSettings: SettingItem[];
  byKey: Record<string, SettingItem>;
  canEdit: boolean;
}) {
  // Collect keys consumed by this section's tier tables
  const tableKeys = new Set<string>();
  for (const t of section.tables ?? []) {
    for (const r of t.rows) {
      for (const k of r.keys) { if (k) tableKeys.add(k); }
    }
  }

  // Individual settings: match key prefixes, not in tables, not excluded
  const individual = allSettings.filter((s) =>
    !tableKeys.has(s.key) && !isExcludedKey(s.key) &&
    section.keyPrefixes.some((p) => s.key.startsWith(p)),
  );

  if (!section.tables?.length && individual.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
        {section.description && <p className="text-xs text-gray-500">{section.description}</p>}
      </div>
      {section.tables?.map((def) => (
        <TierTable key={def.title} def={def} settings={byKey} canEdit={canEdit} />
      ))}
      {individual.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          {individual.map((s) => <SettingRow key={s.id} setting={s} canEdit={canEdit} />)}
        </div>
      )}
    </div>
  );
}

export function PlatformSettingsTabs({ grouped, categories, canEdit, initialSearch = '' }: Props) {
  const [activeTab, setActiveTab] = useState(categories[0] ?? 'general');
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const rawSettings = grouped[activeTab] ?? [];
  const allSettings = searchQuery.trim()
    ? rawSettings.filter((s) => {
        const q = searchQuery.toLowerCase();
        return s.key.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q);
      })
    : rawSettings;

  const byKey: Record<string, SettingItem> = {};
  for (const s of allSettings) { byKey[s.key] = s; }

  const sections = TAB_SECTIONS[activeTab];

  // Track assigned keys to find unassigned
  const assigned = new Set<string>();
  if (sections) {
    for (const sec of sections) {
      for (const t of sec.tables ?? []) {
        for (const r of t.rows) { for (const k of r.keys) { if (k) assigned.add(k); } }
      }
      for (const s of allSettings) {
        if (sec.keyPrefixes.some((p) => s.key.startsWith(p))) assigned.add(s.key);
      }
    }
  }
  const unassigned = sections
    ? allSettings.filter((s) => !assigned.has(s.key) && !isExcludedKey(s.key))
    : allSettings.filter((s) => !isExcludedKey(s.key));

  return (
    <div>
      <div className="mb-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter settings by key or label..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none sm:w-80"
        />
      </div>
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {categories.map((cat) => {
          const count = (grouped[cat] ?? []).length;
          return (
            <button key={cat} type="button" onClick={() => setActiveTab(cat)}
              className={['px-3 py-2 text-sm font-medium transition-colors',
                activeTab === cat ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}>
              {TAB_LABELS[cat] ?? cat}
              {count > 0 && <span className="ml-1.5 text-xs text-gray-400">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-6">
        {sections?.map((sec) => (
          <SectionBlock key={sec.title} section={sec} allSettings={allSettings}
            byKey={byKey} canEdit={canEdit} />
        ))}

        {unassigned.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white">
            {unassigned.map((s) => <SettingRow key={s.id} setting={s} canEdit={canEdit} />)}
          </div>
        )}

        {(!sections || sections.length === 0) && unassigned.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">No settings in this category</p>
        )}
      </div>
    </div>
  );
}
