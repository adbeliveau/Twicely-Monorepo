'use client';

import { useTransition, useState } from 'react';
import { createMeetupLocationAction, toggleMeetupLocationAction } from '@/lib/actions/admin-meetup-locations';

export function CreateMeetupButton() {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', address: '', city: '', state: '', zip: '',
    latitude: 0, longitude: 0, type: 'POLICE_STATION',
  });

  function handleSubmit() {
    if (!form.name || !form.address || !form.city || !form.state || !form.zip) return;
    startTransition(async () => {
      const res = await createMeetupLocationAction({
        ...form, verifiedSafe: false, country: 'US',
      });
      setResult(res.error ?? 'Location created');
      if (!res.error) {
        setOpen(false);
        setForm({ name: '', address: '', city: '', state: '', zip: '', latitude: 0, longitude: 0, type: 'POLICE_STATION' });
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
        Add Location
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">New Safe Meetup Location</h3>
      <div className="grid gap-2 text-sm">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="rounded border px-2 py-1.5" />
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="rounded border px-2 py-1.5" />
        <div className="grid grid-cols-3 gap-2">
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="rounded border px-2 py-1.5" />
          <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" className="rounded border px-2 py-1.5" />
          <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="ZIP" className="rounded border px-2 py-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="any" value={form.latitude || ''} onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })} placeholder="Latitude" className="rounded border px-2 py-1.5" />
          <input type="number" step="any" value={form.longitude || ''} onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })} placeholder="Longitude" className="rounded border px-2 py-1.5" />
        </div>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded border px-2 py-1.5">
          <option value="POLICE_STATION">Police Station</option>
          <option value="FIRE_STATION">Fire Station</option>
          <option value="LIBRARY">Library</option>
          <option value="COMMUNITY_CENTER">Community Center</option>
          <option value="BANK">Bank</option>
        </select>
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={pending} className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white disabled:opacity-50">Create</button>
          <button onClick={() => setOpen(false)} className="rounded border px-3 py-1.5 text-xs text-gray-600">Cancel</button>
        </div>
        {result && <p className="text-xs text-gray-500">{result}</p>}
      </div>
    </div>
  );
}

interface ToggleMeetupProps { locationId: string; isActive: boolean; }

export function ToggleMeetupButton({ locationId, isActive }: ToggleMeetupProps) {
  const [pending, startTransition] = useTransition();
  const [currentActive, setCurrentActive] = useState(isActive);

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleMeetupLocationAction({ locationId, isActive: !currentActive });
      if (!res.error) setCurrentActive(!currentActive);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
        currentActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
      }`}
    >
      {currentActive ? 'Active' : 'Inactive'}
    </button>
  );
}
