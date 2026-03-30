/**
 * Centralized shutdown registry for BullMQ workers and other cleanup functions.
 *
 * Workers created via createWorker() in queue.ts auto-register here.
 * Non-worker cleanup (intervals, scheduler loops) can register manually.
 *
 * Call installShutdownHandlers() once in instrumentation.ts after all
 * job modules are imported — this registers a single SIGTERM/SIGINT handler
 * instead of one per module (which exceeds Node.js default MaxListeners of 10).
 */

type ShutdownFn = () => Promise<void> | void;

const shutdownFns: ShutdownFn[] = [];
let installed = false;

/**
 * Register a cleanup function to run on SIGTERM/SIGINT.
 * Called automatically by createWorker() for BullMQ workers.
 * Call manually for intervals, scheduler loops, or other resources.
 */
export function registerShutdown(fn: ShutdownFn): void {
  shutdownFns.push(fn);
}

/**
 * Install SIGTERM and SIGINT handlers that run all registered shutdown functions.
 * Idempotent — safe to call multiple times.
 */
export function installShutdownHandlers(): void {
  if (installed) return;
  installed = true;

  const shutdown = async () => {
    await Promise.allSettled(shutdownFns.map((fn) => fn()));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
