'use client';

import { useTransition, useState } from 'react';
import {
  issueEnforcementActionAction,
  liftEnforcementActionAction,
} from '@/lib/actions/enforcement';

interface LiftActionButtonProps {
  actionId: string;
  currentStatus: string;
}

export function LiftActionButton({ actionId, currentStatus }: LiftActionButtonProps) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (currentStatus !== 'ACTIVE') {
    return (
      <span className="text-xs text-gray-500">
        Action is {currentStatus.toLowerCase()}
      </span>
    );
  }

  if (done) return <span className="text-xs text-gray-500">{done}</span>;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Reason for lifting (required)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Explain why this action is being lifted..."
          className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>
      <button
        onClick={() => startTransition(async () => {
          if (!reason.trim()) return;
          const res = await liftEnforcementActionAction({ actionId, liftedReason: reason });
          setDone(res.error ? `Error: ${res.error}` : 'Action lifted');
        })}
        disabled={pending || !reason.trim()}
        className="rounded bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
      >
        Lift Action
      </button>
    </div>
  );
}

interface IssueEnforcementFormProps {
  prefillUserId?: string;
  prefillReportId?: string;
}

type ActionType =
  | 'COACHING' | 'WARNING' | 'RESTRICTION' | 'PRE_SUSPENSION' | 'SUSPENSION'
  | 'LISTING_REMOVAL' | 'LISTING_SUPPRESSION' | 'REVIEW_REMOVAL'
  | 'BOOST_DISABLED' | 'LISTING_CAP' | 'SEARCH_DEMOTION' | 'ACCOUNT_BAN';

type TriggerType = 'POLICY_VIOLATION' | 'CONTENT_REPORT' | 'ADMIN_MANUAL';

export function IssueEnforcementForm({ prefillUserId, prefillReportId }: IssueEnforcementFormProps) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [userId, setUserId] = useState(prefillUserId ?? '');
  const [actionType, setActionType] = useState<ActionType>('WARNING');
  const [trigger, setTrigger] = useState<TriggerType>('ADMIN_MANUAL');
  const [reason, setReason] = useState('');
  const [reportId, setReportId] = useState(prefillReportId ?? '');
  const [expiresAt, setExpiresAt] = useState('');

  if (done) return <p className="text-sm text-green-600">{done}</p>;

  return (
    <form className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">User ID</label>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User CUID2..."
          className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Action Type</label>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value as ActionType)}
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
          >
            {[
              'COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
              'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'REVIEW_REMOVAL',
              'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION', 'ACCOUNT_BAN',
            ].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Trigger</label>
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as TriggerType)}
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="ADMIN_MANUAL">Admin Manual</option>
            <option value="POLICY_VIOLATION">Policy Violation</option>
            <option value="CONTENT_REPORT">Content Report</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Reason (required)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Explain the enforcement action..."
          className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Content Report ID (optional)</label>
          <input
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            placeholder="Report CUID2..."
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Expires At (optional)</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => startTransition(async () => {
          const res = await issueEnforcementActionAction({
            userId,
            actionType,
            trigger,
            reason,
            contentReportId: reportId || undefined,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          });
          setDone(res.error ? `Error: ${res.error}` : 'Enforcement action issued');
        })}
        disabled={pending || !userId.trim() || !reason.trim()}
        className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        Issue Enforcement Action
      </button>
    </form>
  );
}
