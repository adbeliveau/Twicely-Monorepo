'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createMeetupLocationAction,
  toggleMeetupLocationAction,
  updateMeetupLocationAction,
} from '@/lib/actions/admin-meetup-locations';
import type { AdminMeetupLocationRow } from '@/lib/queries/admin-meetup-locations';
import { MapPin, CheckCircle, XCircle, Pencil } from 'lucide-react';
import { LocationForm, DEFAULT_FORM } from './meetup-location-form';
import type { EditForm } from './meetup-location-form';

const LOCATION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'POLICE_STATION', label: 'Police Station' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'COMMUNITY', label: 'Community' },
  { value: 'CUSTOM', label: 'Custom' },
];

interface Filters {
  type?: string;
  city?: string;
  state?: string;
}

interface MeetupLocationsTableProps {
  locations: AdminMeetupLocationRow[];
  canEdit: boolean;
  filters?: Filters;
}

export function MeetupLocationsTable({
  locations,
  canEdit,
  filters: initialFilters,
}: MeetupLocationsTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filterType, setFilterType] = useState(initialFilters?.type ?? '');
  const [filterCity, setFilterCity] = useState(initialFilters?.city ?? '');
  const [filterState, setFilterState] = useState(initialFilters?.state ?? '');
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(DEFAULT_FORM);
  const [message, setMessage] = useState<string | null>(null);

  function applyFilters() {
    const params = new URLSearchParams();
    if (filterType) params.set('type', filterType);
    if (filterCity) params.set('city', filterCity);
    if (filterState) params.set('state', filterState);
    const qs = params.toString();
    router.push(`/cfg/meetup-locations${qs ? `?${qs}` : ''}`);
  }

  function openEdit(loc: AdminMeetupLocationRow) {
    setEditId(loc.id);
    setForm({
      name: loc.name, address: loc.address, city: loc.city,
      state: loc.state, zip: loc.zip, country: loc.country,
      latitude: loc.latitude, longitude: loc.longitude,
      type: loc.type, verifiedSafe: loc.verifiedSafe,
    });
    setCreateOpen(false);
    setMessage(null);
  }

  function handleCreate() {
    if (!form.name || !form.address || !form.city || !form.state || !form.zip) return;
    startTransition(async () => {
      const res = await createMeetupLocationAction({ ...form });
      if (res.error) { setMessage(res.error); } else {
        setMessage('Location created');
        setCreateOpen(false);
        setForm(DEFAULT_FORM);
        router.refresh();
      }
    });
  }

  function handleUpdate() {
    if (!editId) return;
    startTransition(async () => {
      const res = await updateMeetupLocationAction({ locationId: editId, ...form });
      if (res.error) { setMessage(res.error); } else {
        setMessage(null);
        setEditId(null);
        router.refresh();
      }
    });
  }

  function handleToggle(locationId: string, isActive: boolean) {
    startTransition(async () => {
      await toggleMeetupLocationAction({ locationId, isActive: !isActive });
      router.refresh();
    });
  }

  const filtered = locations.filter((loc) => {
    if (filterType && loc.type !== filterType) return false;
    if (filterCity && !loc.city.toLowerCase().includes(filterCity.toLowerCase())) return false;
    if (filterState && !loc.state.toLowerCase().includes(filterState.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          {LOCATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          placeholder="Filter by city..."
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          placeholder="Filter by state..."
          className="rounded border border-gray-300 px-2 py-1.5 text-sm w-24"
        />
        <button
          onClick={applyFilters}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Apply
        </button>
        {canEdit && (
          <button
            onClick={() => { setCreateOpen(true); setEditId(null); setForm(DEFAULT_FORM); setMessage(null); }}
            className="ml-auto rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            Add Location
          </button>
        )}
      </div>

      {createOpen && canEdit && (
        <LocationForm
          form={form} setForm={setForm} onSubmit={handleCreate}
          onCancel={() => { setCreateOpen(false); setMessage(null); }}
          pending={pending} title="New Safe Meetup Location" submitLabel="Create" message={message}
        />
      )}

      {editId && canEdit && (
        <LocationForm
          form={form} setForm={setForm} onSubmit={handleUpdate}
          onCancel={() => { setEditId(null); setMessage(null); }}
          pending={pending} title="Edit Meetup Location" submitLabel="Save" message={message}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 font-medium text-gray-600">City/State</th>
              <th className="px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 font-medium text-gray-600">Verified</th>
              <th className="px-4 py-3 font-medium text-gray-600">Active</th>
              <th className="px-4 py-3 font-medium text-gray-600">Meetups</th>
              {canEdit && <th className="px-4 py-3 font-medium text-gray-600">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.map((loc) => (
              <tr key={loc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{loc.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{loc.city}, {loc.state}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {loc.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {loc.verifiedSafe
                    ? <CheckCircle className="h-4 w-4 text-green-500" />
                    : <XCircle className="h-4 w-4 text-gray-300" />}
                </td>
                <td className="px-4 py-3">
                  {canEdit ? (
                    <button
                      onClick={() => handleToggle(loc.id, loc.isActive)}
                      disabled={pending}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                        loc.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {loc.isActive ? 'Active' : 'Inactive'}
                    </button>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      loc.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {loc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{loc.meetupCount}</td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(loc)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      aria-label="Edit location"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-center text-gray-400">
                  No meetup locations found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
