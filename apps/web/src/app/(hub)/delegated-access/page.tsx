import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdminDelegationKPIs, getAdminDelegations } from '@/lib/queries/admin-delegations';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@twicely/ui/table';

export const metadata: Metadata = {
  title: 'Delegated Access | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function DelegatedAccessPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'DelegatedAccess')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [kpis, { rows, total }] = await Promise.all([
    getAdminDelegationKPIs(),
    getAdminDelegations({ limit: 50, offset: 0 }),
  ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Delegated Access"
        description="Platform-wide staff delegation oversight."
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.totalActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.totalPending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revoked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.totalRevoked}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sellers with Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.sellersWithStaff}</p>
          </CardContent>
        </Card>
      </div>

      {/* Delegations table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All Delegations
            <span className="ml-2 text-sm font-normal text-muted-foreground">({total} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No delegations found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{row.staffName}</div>
                      <div className="text-xs text-muted-foreground">{row.staffEmail}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{row.sellerName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {row.scopes.join(', ') || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium">{row.status}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {row.invitedAt.toLocaleDateString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
