'use client';

import { useState, useEffect, useCallback } from 'react';

interface BannedKeyword {
  id: string;
  keyword: string;
  category: string;
  action: string;
  isActive: boolean;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  block: 'bg-red-100 text-red-800',
  flag: 'bg-yellow-100 text-yellow-800',
  warn: 'bg-blue-100 text-blue-800',
};

const CATEGORY_COLORS: Record<string, string> = {
  contact_info: 'bg-purple-100 text-purple-800',
  profanity: 'bg-orange-100 text-orange-800',
  spam: 'bg-gray-100 text-gray-800',
  scam: 'bg-red-100 text-red-800',
};

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';

export function KeywordManagement({ canEdit }: { canEdit: boolean }) {
  const [keywords, setKeywords] = useState<BannedKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('spam');
  const [newAction, setNewAction] = useState('flag');

  const fetchKeywords = useCallback(() => {
    setLoading(true);
    fetch('/api/platform/messaging/keywords')
      .then((r) => r.json())
      .then((data) => setKeywords(data.keywords ?? []))
      .catch(() => setKeywords([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchKeywords(); }, [fetchKeywords]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!newKeyword.trim()) { setError('Keyword is required'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/platform/messaging/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: newKeyword.trim().toLowerCase(), category: newCategory, action: newAction }),
      });
      if (res.ok) { setNewKeyword(''); setShowForm(false); fetchKeywords(); }
      else { const d = await res.json(); setError(d.error ?? 'Failed to add keyword'); }
    } catch { setError('Failed to add keyword'); }
    finally { setSubmitting(false); }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/platform/messaging/keywords/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to update keyword' }));
        setError(data.error ?? 'Failed to update keyword');
        return;
      }
      fetchKeywords();
    } catch {
      setError('Failed to update keyword');
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Loading keywords...</div>;
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {showForm ? 'Cancel' : 'Add Keyword'}
          </button>
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {error && <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleAdd} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-500">Keyword</label>
              <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                className={inputCls} placeholder="e.g. wire transfer" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Category</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className={inputCls}>
                <option value="contact_info">Contact Info</option>
                <option value="profanity">Profanity</option>
                <option value="spam">Spam</option>
                <option value="scam">Scam</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Action</label>
              <select value={newAction} onChange={(e) => setNewAction(e.target.value)} className={inputCls}>
                <option value="block">Block</option>
                <option value="flag">Flag</option>
                <option value="warn">Warn</option>
              </select>
            </div>
            <button type="submit" disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {['Keyword', 'Category', 'Action', 'Status', 'Added', 'Actions'].map((h, i) => (
                <th key={h} className={`px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 ${
                  i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {keywords.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No banned keywords configured</td></tr>
            ) : keywords.map((kw) => (
              <tr key={kw.id} className={!kw.isActive ? 'opacity-50' : ''}>
                <td className="px-6 py-4">
                  <code className="rounded bg-gray-100 px-2 py-1 font-mono text-sm">{kw.keyword}</code>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${CATEGORY_COLORS[kw.category] ?? 'bg-gray-100 text-gray-700'}`}>
                    {kw.category.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${ACTION_COLORS[kw.action] ?? 'bg-gray-100 text-gray-700'}`}>
                    {kw.action}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm ${kw.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {kw.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(kw.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  {canEdit && (
                    <button onClick={() => handleToggle(kw.id, kw.isActive)}
                      className="text-sm text-blue-600 hover:text-blue-700">
                      {kw.isActive ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-500">
        {keywords.filter((k) => k.isActive).length} active keywords out of {keywords.length} total
      </div>
    </div>
  );
}
