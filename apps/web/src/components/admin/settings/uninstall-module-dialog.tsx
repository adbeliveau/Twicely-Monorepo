'use client';

import { useState, useTransition } from 'react';
import { uninstallModule } from '@/lib/actions/admin-modules';

interface UninstallModuleDialogProps {
  moduleId: string;
  label: string;
  open: boolean;
  onClose: () => void;
}

const MODULE_CONSEQUENCES: Record<string, string[]> = {
  'payments.stripe': ['All payment processing will stop', 'Pending payouts will fail', 'Subscription billing will halt'],
  'shipping.shippo': ['Label generation will be unavailable', 'Tracking updates will stop'],
  'search.typesense': ['Search functionality will be disabled', 'Listing discovery will degrade'],
  'cache.valkey': ['Session caching will be disabled', 'Job queue will stop processing'],
  'realtime.centrifugo': ['Real-time notifications will stop', 'Live updates will be unavailable'],
  'email.resend': ['All transactional emails will stop', 'Order confirmations will not send'],
  'storage.r2': ['Image uploads will fail', 'Existing images may become inaccessible'],
};

const DEFAULT_CONSEQUENCES = ['Module features will be unavailable', 'Related background jobs will stop'];

export function UninstallModuleDialog({ moduleId, label, open, onClose }: UninstallModuleDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [confirmText, setConfirmText] = useState('');
  const [isPending, startTransition] = useTransition();

  const consequences = MODULE_CONSEQUENCES[moduleId] ?? DEFAULT_CONSEQUENCES;

  function handleClose() {
    setStep(1);
    setConfirmText('');
    onClose();
  }

  function handleFinalUninstall() {
    if (confirmText !== 'DELETE') return;
    startTransition(async () => {
      await uninstallModule({ moduleId, confirmText: 'DELETE' });
      handleClose();
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900">Uninstall {label}?</h2>
            <p className="mt-2 text-sm text-gray-600">This will disable and remove the module. Consequences:</p>
            <ul className="mt-3 space-y-1">
              {consequences.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-red-700">
                  <span className="mt-0.5 text-red-500">&#x2022;</span>
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={handleClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={() => setStep(2)} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900">Confirm Uninstall</h2>
            <p className="mt-2 text-sm text-gray-600">
              Type <strong>DELETE</strong> to confirm uninstalling <strong>{label}</strong>.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="mt-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => { setStep(1); setConfirmText(''); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                Back
              </button>
              <button
                type="button"
                onClick={() => { if (confirmText === 'DELETE') setStep(3); }}
                disabled={confirmText !== 'DELETE'}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold text-red-700">Final Warning</h2>
            <p className="mt-2 text-sm text-red-600">
              This action is irreversible. <strong>{label}</strong> will be permanently removed.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={handleClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalUninstall}
                disabled={isPending}
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {isPending ? 'Uninstalling...' : 'Uninstall Now'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
