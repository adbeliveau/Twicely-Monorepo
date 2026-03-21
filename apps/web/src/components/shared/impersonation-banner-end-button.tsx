'use client';

import { useState } from 'react';

export function EndImpersonationButton() {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    if (loading) return;
    setLoading(true);
    fetch('/api/hub/impersonation/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      redirect: 'follow',
    })
      .then((r) => {
        if (r.ok || r.redirected) {
          window.location.href = r.url;
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleClick}
      className="rounded bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-60"
    >
      {loading ? 'Ending…' : 'End impersonation'}
    </button>
  );
}
