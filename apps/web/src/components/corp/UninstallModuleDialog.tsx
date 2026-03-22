"use client";

import { useState } from "react";

interface UninstallModuleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  module: {
    moduleId: string;
    label: string;
    consequences: string[];
  };
  onUninstall: () => Promise<void>;
}

export default function UninstallModuleDialog({
  isOpen,
  onClose,
  module,
  onUninstall,
}: UninstallModuleDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [confirmText, setConfirmText] = useState("");
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedText = `DELETE ${module.label.toUpperCase()}`;
  const isConfirmValid = confirmText === expectedText;

  const handleClose = () => {
    setStep(1);
    setConfirmText("");
    setError(null);
    onClose();
  };

  const handleUninstall = async () => {
    setIsUninstalling(true);
    setError(null);
    try {
      await onUninstall();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to uninstall module");
    } finally {
      setIsUninstalling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {step === 1 && "Uninstall Module"}
            {step === 2 && "Warning"}
            {step === 3 && "Final Confirmation"}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {step === 1 && (
            <div>
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to uninstall <span className="font-semibold">{module.label}</span>?
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This will disable all functionality provided by this module.
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                  <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    You are about to permanently delete {module.label}.
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    This will remove:
                  </p>
                </div>
              </div>

              <ul className="mb-4 ml-4 space-y-1">
                {module.consequences.map((consequence, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-red-500">•</span>
                    {consequence}
                  </li>
                ))}
              </ul>

              <p className="mb-4 font-medium text-red-600 dark:text-red-400">
                This action CANNOT be undone.
              </p>

              <div>
                <label className="mb-2 block text-sm text-gray-700 dark:text-gray-300">
                  Type &quot;<span className="font-mono font-semibold">{expectedText}</span>&quot; to confirm:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={expectedText}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-4 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>

              <h3 className="mb-4 text-center text-lg font-bold text-red-600 dark:text-red-400">
                FINAL WARNING
              </h3>

              <p className="mb-4 text-center text-gray-700 dark:text-gray-300">
                Clicking &quot;Delete Forever&quot; will immediately:
              </p>

              <ul className="mb-4 space-y-2">
                {module.consequences.map((consequence, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {consequence}
                  </li>
                ))}
              </ul>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                There is NO recovery. You will need to completely reconfigure {module.label} from scratch.
              </p>

              {error && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={isUninstalling}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              Continue
            </button>
          )}

          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={!isConfirmValid}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              Continue
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleUninstall}
              disabled={isUninstalling}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {isUninstalling ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Forever
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
