/**
 * Toast component re-export.
 *
 * The application uses Sonner for toast notifications.
 * This module re-exports Sonner's toast API so that package consumers
 * can import from @twicely/ui/toast.
 */

export { toast, Toaster } from 'sonner';
export type { ExternalToast, ToastT } from 'sonner';
