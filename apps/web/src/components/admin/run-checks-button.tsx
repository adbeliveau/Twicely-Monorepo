'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { runDoctorChecksAction } from '@/lib/actions/health-checks';

export function RunChecksButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      await runDoctorChecksAction();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run checks');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleClick} disabled={loading} size="sm">
        {loading ? 'Running...' : 'Run All Checks'}
      </Button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
