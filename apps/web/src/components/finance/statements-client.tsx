'use client';

import { useState } from 'react';
import { ReportGenerator } from './report-generator';
import { ReportList } from './report-list';
import type { SavedReport } from '@/lib/queries/finance-center-reports';

export function StatementsClient() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleReportGenerated(_report: SavedReport) {
    setRefreshTrigger((n) => n + 1);
  }

  return (
    <div className="space-y-6">
      <ReportGenerator onReportGenerated={handleReportGenerated} />
      <ReportList refreshTrigger={refreshTrigger} />
    </div>
  );
}
