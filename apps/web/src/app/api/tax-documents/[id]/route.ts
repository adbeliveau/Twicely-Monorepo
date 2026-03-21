import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@twicely/casl/authorize';
import { sub } from '@twicely/casl';
import { db } from '@twicely/db';
import { financialReport } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, ability } = await authorize();
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  if (!ability.can('read', sub('FinancialReport', { userId: session.userId }))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { id } = await params;

  const [report] = await db
    .select({
      id: financialReport.id,
      userId: financialReport.userId,
      reportType: financialReport.reportType,
      fileUrl: financialReport.fileUrl,
      snapshotJson: financialReport.snapshotJson,
    })
    .from(financialReport)
    .where(eq(financialReport.id, id))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (report.userId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (report.reportType !== '1099_K' && report.reportType !== '1099_NEC') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: report.id,
    reportType: report.reportType,
    data: report.snapshotJson,
  });
}
