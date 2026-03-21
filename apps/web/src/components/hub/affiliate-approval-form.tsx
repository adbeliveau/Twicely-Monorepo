'use client';

import { useState, useTransition } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { approveInfluencerApplication, rejectInfluencerApplication } from '@/lib/actions/affiliate-admin';

interface AffiliateApprovalFormProps {
  affiliateId: string;
  defaultCommissionRateBps: number;
  defaultCookieDurationDays: number;
  defaultCommissionDurationMonths: number;
}

export function AffiliateApprovalForm({
  affiliateId,
  defaultCommissionRateBps,
  defaultCookieDurationDays,
  defaultCommissionDurationMonths,
}: AffiliateApprovalFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  const [commissionRateBps, setCommissionRateBps] = useState(
    String(defaultCommissionRateBps)
  );
  const [cookieDurationDays, setCookieDurationDays] = useState(
    String(defaultCookieDurationDays)
  );
  const [commissionDurationMonths, setCommissionDurationMonths] = useState(
    String(defaultCommissionDurationMonths)
  );
  const [adminNote, setAdminNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveInfluencerApplication({
        affiliateId,
        commissionRateBps: parseInt(commissionRateBps, 10),
        cookieDurationDays: parseInt(cookieDurationDays, 10),
        commissionDurationMonths: parseInt(commissionDurationMonths, 10),
        adminNote: adminNote.trim() || undefined,
      });
      if (result.success) {
        setDone('approved');
      } else {
        setError(result.error ?? 'Approval failed');
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectInfluencerApplication({
        affiliateId,
        rejectionReason: rejectionReason.trim(),
      });
      if (result.success) {
        setDone('rejected');
      } else {
        setError(result.error ?? 'Rejection failed');
      }
    });
  }

  if (done === 'approved') {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-green-700 font-medium">Application approved successfully.</p>
        </CardContent>
      </Card>
    );
  }

  if (done === 'rejected') {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-orange-700 font-medium">
            Application rejected. Affiliate reverted to Community tier.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review Application</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {(mode === null || mode === 'approve') && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="commissionRateBps" className="text-xs">Commission (bps)</Label>
                <Input
                  id="commissionRateBps"
                  type="number"
                  min={2000}
                  max={3000}
                  value={commissionRateBps}
                  onChange={(e) => setCommissionRateBps(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-0.5 text-xs text-gray-400">2000–3000 (20–30%)</p>
              </div>
              <div>
                <Label htmlFor="cookieDurationDays" className="text-xs">Cookie days</Label>
                <Input
                  id="cookieDurationDays"
                  type="number"
                  min={30}
                  max={90}
                  value={cookieDurationDays}
                  onChange={(e) => setCookieDurationDays(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="commissionDurationMonths" className="text-xs">Duration (months)</Label>
                <Input
                  id="commissionDurationMonths"
                  type="number"
                  min={6}
                  max={24}
                  value={commissionDurationMonths}
                  onChange={(e) => setCommissionDurationMonths(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="adminNote" className="text-xs">Admin note (optional)</Label>
              <Textarea
                id="adminNote"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Internal note..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                disabled={isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isPending ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode('reject')}
                disabled={isPending}
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              >
                Reject
              </Button>
            </div>
          </div>
        )}

        {mode === 'reject' && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="rejectionReason" className="text-xs">Rejection reason</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the application was rejected..."
                className="mt-1"
                rows={3}
              />
              <p className="mt-0.5 text-xs text-gray-400">Minimum 10 characters.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setMode('approve')}
                disabled={isPending}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleReject}
                disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {isPending ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
