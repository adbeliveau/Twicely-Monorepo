'use client';

import { useState } from 'react';
import { ReportGenerator } from '@/components/finance/report-generator';
import { ReportList } from '@/components/finance/report-list';

export function ReportsClient() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="space-y-6">
      <ReportGenerator
        onReportGenerated={() => setRefreshTrigger((n) => n + 1)}
      />
      <ReportList refreshTrigger={refreshTrigger} />
    </div>
  );
}
