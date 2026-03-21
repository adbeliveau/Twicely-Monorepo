'use client';

import { useState, useTransition } from 'react';
import { saveGeneralSettings } from '@/lib/actions/admin-settings';
import { CentsInput } from './cents-input';

type SettingRow = { id: string; key: string; value: unknown };

interface SettingsHubFormProps {
  dbSettings: SettingRow[];
  canEdit: boolean;
}

type FormState = {
  siteName: string;
  supportEmail: string;
  siteDescription: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  sellerRegistrationEnabled: boolean;
  defaultCurrency: string;
  minListingPriceCents: number;
  maxListingPriceCents: number;
  staffInactivityTimeoutMinutes: number;
  userInactivityTimeoutMinutes: number;
  userSessionMaxDays: number;
};

const DEFAULTS: FormState = {
  siteName: 'Twicely',
  supportEmail: 'support@twicely.com',
  siteDescription: 'Buy and sell pre-loved items',
  maintenanceMode: false,
  registrationEnabled: true,
  sellerRegistrationEnabled: true,
  defaultCurrency: 'USD',
  minListingPriceCents: 100,
  maxListingPriceCents: 10000000,
  staffInactivityTimeoutMinutes: 5,
  userInactivityTimeoutMinutes: 1440,
  userSessionMaxDays: 30,
};

function buildInitial(dbSettings: SettingRow[]): FormState {
  const state = { ...DEFAULTS };
  for (const row of dbSettings) {
    const short = row.key.replace('general.', '') as keyof FormState;
    if (short in state) {
      (state as Record<string, unknown>)[short] = row.value;
    }
  }
  return state;
}

function Toggle({ on, onToggle, disabled, red }: {
  on: boolean; onToggle: () => void; disabled?: boolean; red?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={[
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        on ? (red ? 'bg-red-600' : 'bg-blue-600') : 'bg-gray-300',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span className={[
        'inline-block h-4 w-4 rounded-full bg-white transition-transform',
        on ? 'translate-x-6' : 'translate-x-1',
      ].join(' ')} />
    </button>
  );
}

function ToggleRow({ label, desc, on, onToggle, disabled, red }: {
  label: string; desc: string; on: boolean; onToggle: () => void;
  disabled?: boolean; red?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{desc}</p>
      </div>
      <Toggle on={on} onToggle={onToggle} disabled={disabled} red={red} />
    </div>
  );
}

const inputCls = 'mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function SettingsHubForm({ dbSettings, canEdit }: SettingsHubFormProps) {
  const [s, setS] = useState<FormState>(() => buildInitial(dbSettings));
  const [isPending, startTransition] = useTransition();
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);

  function handleSave() {
    setSaveResult(null);
    startTransition(async () => {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s)) {
        payload[`general.${k}`] = v;
      }
      const res = await saveGeneralSettings(payload);
      setSaveResult(res.error ? 'error' : 'success');
      if (!res.error) setTimeout(() => setSaveResult(null), 3000);
    });
  }

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setS((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      {/* General */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">General</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Site Name</label>
            <input type="text" value={s.siteName} disabled={!canEdit}
              onChange={(e) => set('siteName', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Support Email</label>
            <input type="email" value={s.supportEmail} disabled={!canEdit}
              onChange={(e) => set('supportEmail', e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Site Description</label>
            <input type="text" value={s.siteDescription} disabled={!canEdit}
              onChange={(e) => set('siteDescription', e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Registration & Access */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Registration & Access</h2>
        <div className="space-y-4">
          <ToggleRow label="Maintenance Mode" desc="Disable public access to the platform"
            on={s.maintenanceMode} onToggle={() => set('maintenanceMode', !s.maintenanceMode)}
            disabled={!canEdit} red />
          <ToggleRow label="User Registration" desc="Allow new users to register"
            on={s.registrationEnabled} onToggle={() => set('registrationEnabled', !s.registrationEnabled)}
            disabled={!canEdit} />
          <ToggleRow label="Seller Registration" desc="Allow users to become sellers"
            on={s.sellerRegistrationEnabled}
            onToggle={() => set('sellerRegistrationEnabled', !s.sellerRegistrationEnabled)}
            disabled={!canEdit} />
        </div>
      </div>

      {/* Security */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Security</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Staff Inactivity Timeout (minutes)</label>
            <input type="number" min={1} max={480} value={s.staffInactivityTimeoutMinutes}
              disabled={!canEdit} className={inputCls}
              onChange={(e) => set('staffInactivityTimeoutMinutes', parseInt(e.target.value) || 5)} />
            <p className="mt-1 text-xs text-gray-500">
              Staff sessions are logged out after this many minutes of inactivity. Default: 5 minutes.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">User Inactivity Timeout (minutes)</label>
            <input type="number" min={1} max={10080} value={s.userInactivityTimeoutMinutes}
              disabled={!canEdit} className={inputCls}
              onChange={(e) => set('userInactivityTimeoutMinutes', parseInt(e.target.value) || 1440)} />
            <p className="mt-1 text-xs text-gray-500">
              Regular user sessions expire after inactivity. Default: 1440 (24 hours).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">User Session Max Days</label>
            <input type="number" min={1} max={365} value={s.userSessionMaxDays}
              disabled={!canEdit} className={inputCls}
              onChange={(e) => set('userSessionMaxDays', parseInt(e.target.value) || 30)} />
            <p className="mt-1 text-xs text-gray-500">
              Maximum session lifetime regardless of activity. Default: 30 days.
            </p>
          </div>
        </div>
      </div>

      {/* Commerce */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Commerce</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Default Currency</label>
            <select value={s.defaultCurrency} disabled={!canEdit} className={inputCls}
              onChange={(e) => set('defaultCurrency', e.target.value)}>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Min Listing Price</label>
            <CentsInput value={s.minListingPriceCents} disabled={!canEdit}
              onChange={(cents) => set('minListingPriceCents', cents)} />
            <p className="mt-1 text-xs text-gray-500">Minimum price sellers can set for listings</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Max Listing Price</label>
            <CentsInput value={s.maxListingPriceCents} disabled={!canEdit}
              onChange={(cents) => set('maxListingPriceCents', cents)} />
            <p className="mt-1 text-xs text-gray-500">Maximum price sellers can set for listings</p>
          </div>
        </div>
      </div>

      {/* Save */}
      {canEdit && (
        <div className="flex items-center justify-end gap-3">
          {saveResult === 'success' && (
            <span className="text-sm text-green-600">Settings saved successfully!</span>
          )}
          {saveResult === 'error' && (
            <span className="text-sm text-red-600">Failed to save settings</span>
          )}
          <button onClick={handleSave} disabled={isPending}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
