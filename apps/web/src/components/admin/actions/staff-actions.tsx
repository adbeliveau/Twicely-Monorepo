'use client';

/**
 * StaffActions — Action buttons + modals for staff detail page.
 * V2 design: Edit (outline), Reset Password (outline), Suspend (yellow outline),
 * Reactivate (green outline), Terminate (red outline).
 * Each destructive action opens a confirmation modal.
 */

import { useTransition, useState } from 'react';
import {
  deactivateStaffAction,
  reactivateStaffAction,
  resetStaffPasswordAction,
} from '@/lib/actions/admin-staff-lifecycle';

interface StaffActionsProps {
  staffUserId: string;
  isActive: boolean;
  canManage: boolean;
}

export function StaffActions({ staffUserId, isActive, canManage }: StaffActionsProps) {
  const [pending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState('');

  // Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  if (!canManage) return null;

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  function handleResetPassword() {
    if (newPassword.length < 10) return;
    startTransition(async () => {
      const res = await resetStaffPasswordAction({ staffUserId, newPassword });
      if (res.error) { flash(res.error); } else { flash('Password reset successfully'); }
      setShowPasswordModal(false);
      setNewPassword('');
    });
  }

  function handleStatusChange() {
    startTransition(async () => {
      if (isActive) {
        const res = await deactivateStaffAction({ staffUserId, reason: 'Suspended by admin' });
        if (res.error) { flash(res.error); } else { flash('Employee suspended'); }
      } else {
        const res = await reactivateStaffAction({ staffUserId });
        if (res.error) { flash(res.error); } else { flash('Employee reactivated'); }
      }
      setShowStatusModal(false);
    });
  }

  function handleTerminate() {
    startTransition(async () => {
      const res = await deactivateStaffAction({ staffUserId, reason: 'Terminated by admin' });
      if (res.error) { flash(res.error); } else { flash('Employee terminated'); }
      setShowTerminateModal(false);
    });
  }

  // V2 button styles — outlined with colored borders
  const outlineBtn =
    'rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50';
  const suspendBtn =
    'rounded-lg border border-yellow-300 px-3 py-1.5 text-sm font-medium text-yellow-700 transition-colors hover:bg-yellow-50';
  const reactivateBtn =
    'rounded-lg border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-50';
  const terminateBtn =
    'rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50';

  return (
    <>
      {/* Success flash */}
      {successMsg && (
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 shadow-lg">
          {successMsg}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button className={outlineBtn} disabled={pending}>Edit</button>
        <button onClick={() => setShowPasswordModal(true)} className={outlineBtn} disabled={pending}>
          Reset Password
        </button>
        {isActive ? (
          <button onClick={() => setShowStatusModal(true)} className={suspendBtn} disabled={pending}>
            Suspend
          </button>
        ) : (
          <button onClick={() => setShowStatusModal(true)} className={reactivateBtn} disabled={pending}>
            Reactivate
          </button>
        )}
        <button onClick={() => setShowTerminateModal(true)} className={terminateBtn} disabled={pending}>
          Terminate
        </button>
      </div>

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <ModalBackdrop>
          <ModalCard>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Reset Password</h3>
            <p className="mb-4 text-sm text-gray-600">
              Set a new password. All active sessions will be terminated.
            </p>
            <input
              type="text"
              placeholder="New password (min 10 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
            />
            <ModalFooter>
              <button onClick={() => { setShowPasswordModal(false); setNewPassword(''); }} className={outlineBtn}>
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={pending || newPassword.length < 10}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {pending ? 'Resetting...' : 'Reset Password'}
              </button>
            </ModalFooter>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* Status Change Modal */}
      {showStatusModal && (
        <ModalBackdrop>
          <ModalCard>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {isActive ? 'Suspend Employee' : 'Reactivate Employee'}
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              {isActive
                ? 'Suspending will immediately end all active sessions and prevent login.'
                : 'Reactivating will allow this employee to log in again.'}
            </p>
            <ModalFooter>
              <button onClick={() => setShowStatusModal(false)} className={outlineBtn}>Cancel</button>
              <button
                onClick={handleStatusChange}
                disabled={pending}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  isActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {pending ? 'Processing...' : isActive ? 'Suspend' : 'Reactivate'}
              </button>
            </ModalFooter>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* Terminate Modal */}
      {showTerminateModal && (
        <ModalBackdrop>
          <ModalCard>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Terminate Employee</h3>
            </div>
            <p className="mb-2 text-sm text-gray-600">This will permanently terminate access:</p>
            <ul className="mb-4 list-inside list-disc text-sm text-gray-600">
              <li>All active sessions will be destroyed</li>
              <li>All roles will be revoked</li>
              <li>Login will be permanently blocked</li>
            </ul>
            <p className="mb-4 text-sm font-medium text-red-600">
              This action requires SUPER_ADMIN and cannot be undone.
            </p>
            <ModalFooter>
              <button onClick={() => setShowTerminateModal(false)} className={outlineBtn}>Cancel</button>
              <button
                onClick={handleTerminate}
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? 'Terminating...' : 'Terminate Employee'}
              </button>
            </ModalFooter>
          </ModalCard>
        </ModalBackdrop>
      )}
    </>
  );
}

// ─── Modal primitives ────────────────────────────────────────────────────────

function ModalBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {children}
    </div>
  );
}

function ModalCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
      {children}
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>;
}
