import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@twicely/ui/table';
import type {
  RetentionPolicyEntry,
  DeletionQueueEntry,
  GdprComplianceSummary,
  RetentionJobStatus,
} from '@/lib/actions/admin-data-retention';
import type { InferSelectModel } from 'drizzle-orm';
import type { dataExportRequest } from '@twicely/db/schema';
import { GdprComplianceCard, RetentionJobStatusCard } from './gdpr-compliance-card';

interface Props {
  policies: RetentionPolicyEntry[];
  deletionQueue: DeletionQueueEntry[];
  exportRequests: InferSelectModel<typeof dataExportRequest>[];
  gdprSummary?: GdprComplianceSummary;
  jobStatus?: RetentionJobStatus;
}

export function RetentionDashboard({ policies, deletionQueue, exportRequests, gdprSummary, jobStatus }: Props) {
  return (
    <div className="space-y-6">
      {/* GDPR Compliance Summary — G8.4 */}
      {gdprSummary && <GdprComplianceCard summary={gdprSummary} />}

      {/* Retention Job Status — G8.4 */}
      {jobStatus && <RetentionJobStatusCard status={jobStatus} />}

      {/* Retention Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Retention Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setting</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.key}>
                  <TableCell className="font-medium">{policy.label}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {String(policy.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* GDPR Deletion Queue */}
      <Card>
        <CardHeader>
          <CardTitle>GDPR Deletion Queue ({deletionQueue.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {deletionQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending deletion requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Deletion Date</TableHead>
                  <TableHead className="text-right">Days Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletionQueue.map((entry) => (
                  <TableRow key={entry.userId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">{entry.emailMasked}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(entry.deletionRequestedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(entry.deletionDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          entry.daysRemaining <= 3 ? 'text-destructive font-bold' : ''
                        }
                      >
                        {entry.daysRemaining}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Data Export Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Data Export Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {exportRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No export requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request ID</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exportRequests.slice(0, 50).map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-xs">{req.id}</TableCell>
                    <TableCell>{req.format.toUpperCase()}</TableCell>
                    <TableCell>{req.status}</TableCell>
                    <TableCell>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {req.completedAt
                        ? new Date(req.completedAt).toLocaleDateString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
