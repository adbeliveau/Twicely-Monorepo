import { db } from '@twicely/db';
import { helpdeskCase } from '@twicely/db/schema';
import { and, eq, ilike, ne, not, or, desc } from 'drizzle-orm';

export interface MergeSearchResult {
  id: string;
  caseNumber: string;
  subject: string;
  requesterEmail: string | null;
  status: string;
}

/**
 * Searches open cases as merge targets.
 * Excludes CLOSED cases and the current case itself.
 * Returns top 10 results by last activity.
 */
export async function searchCasesForMerge(
  query: string,
  excludeCaseId: string
): Promise<MergeSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const pattern = `%${trimmed}%`;

  return db
    .select({
      id: helpdeskCase.id,
      caseNumber: helpdeskCase.caseNumber,
      subject: helpdeskCase.subject,
      requesterEmail: helpdeskCase.requesterEmail,
      status: helpdeskCase.status,
    })
    .from(helpdeskCase)
    .where(
      and(
        ne(helpdeskCase.id, excludeCaseId),
        not(eq(helpdeskCase.status, 'CLOSED')),
        or(
          ilike(helpdeskCase.caseNumber, pattern),
          ilike(helpdeskCase.subject, pattern)
        )
      )
    )
    .orderBy(desc(helpdeskCase.lastActivityAt))
    .limit(10);
}
