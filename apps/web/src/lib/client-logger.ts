/**
 * Browser-safe logger for "use client" components.
 *
 * Unlike @twicely/logger (pino-backed, Node.js-only), this module uses
 * only browser-native console APIs and is safe to import from any client
 * component. All output is prefixed with [twicely] for easy filtering.
 */

export const clientLogger = {
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn('[twicely]', message, context ?? '');
  },
  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    console.error('[twicely]', message, error, context ?? '');
  },
};
