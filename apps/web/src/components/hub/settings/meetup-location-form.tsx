'use client';

export interface EditForm {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude: number;
  longitude: number;
  type: string;
  verifiedSafe: boolean;
}

export const DEFAULT_FORM: EditForm = {
  name: '', address: '', city: '', state: '', zip: '',
  country: 'US', latitude: 0, longitude: 0,
  type: 'POLICE_STATION', verifiedSafe: false,
};

interface LocationFormProps {
  form: EditForm;
  setForm: (f: EditForm) => void;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  title: string;
  submitLabel: string;
  message: string | null;
}

export function LocationForm({
  form, setForm, onSubmit, onCancel, pending, title, submitLabel, message,
}: LocationFormProps) {
  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="grid gap-2 text-sm">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name"
          className="rounded border px-2 py-1.5"
        />
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Address"
          className="rounded border px-2 py-1.5"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="City"
            className="rounded border px-2 py-1.5"
          />
          <input
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            placeholder="State"
            className="rounded border px-2 py-1.5"
          />
          <input
            value={form.zip}
            onChange={(e) => setForm({ ...form, zip: e.target.value })}
            placeholder="ZIP"
            className="rounded border px-2 py-1.5"
          />
        </div>
        <input
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          placeholder="Country (default: US)"
          className="rounded border px-2 py-1.5"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            value={form.latitude || ''}
            onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })}
            placeholder="Latitude"
            className="rounded border px-2 py-1.5"
          />
          <input
            type="number"
            step="any"
            value={form.longitude || ''}
            onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })}
            placeholder="Longitude"
            className="rounded border px-2 py-1.5"
          />
        </div>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="rounded border px-2 py-1.5"
        >
          <option value="POLICE_STATION">Police Station</option>
          <option value="RETAIL">Retail</option>
          <option value="COMMUNITY">Community</option>
          <option value="CUSTOM">Custom</option>
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.verifiedSafe}
            onChange={(e) => setForm({ ...form, verifiedSafe: e.target.checked })}
          />
          <span>Verified Safe</span>
        </label>
        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={pending}
            className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {submitLabel}
          </button>
          <button
            onClick={onCancel}
            className="rounded border px-3 py-1.5 text-xs text-gray-600"
          >
            Cancel
          </button>
        </div>
        {message && <p className="text-xs text-gray-500">{message}</p>}
      </div>
    </div>
  );
}
