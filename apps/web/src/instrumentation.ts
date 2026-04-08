/**
 * Next.js instrumentation hook — runs once on application startup.
 * Used to initialize in-process BullMQ workers (Railway single-container model).
 * Source: F3.1 install prompt §3.11; Decision #62 (Railway deployment)
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate required environment variables at startup (A10 + A5)
    const critical = [
      'DATABASE_URL', 'BETTER_AUTH_SECRET', 'ENCRYPTION_KEY', 'PROVIDER_ENCRYPTION_KEY',
      'CRON_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    ];
    const recommended = [
      'RESEND_API_KEY', 'TYPESENSE_API_KEY',
      'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
      'CENTRIFUGO_API_KEY', 'CENTRIFUGO_TOKEN_HMAC_SECRET', 'VALKEY_URL',
    ];
    const missingCritical = critical.filter((v) => !process.env[v]);
    if (missingCritical.length > 0) {
      throw new Error(`Missing required environment variables: ${missingCritical.join(', ')}`);
    }
    const missingRecommended = recommended.filter((v) => !process.env[v]);
    if (missingRecommended.length > 0) {
      // Use dynamic import — logger is safe to import after env validation for critical vars
      const { logger } = await import('@twicely/logger');
      logger.warn('[startup] Missing recommended env vars (some features may not work)', {
        missing: missingRecommended,
      });
    }

    // A5: Validate JWT HMAC secret length (>= 32 chars for HS256 security)
    const hmacSecrets = ['CENTRIFUGO_TOKEN_HMAC_SECRET', 'EXTENSION_JWT_SECRET'] as const;
    for (const key of hmacSecrets) {
      const val = process.env[key];
      if (val && val.length < 32) {
        throw new Error(`${key} must be at least 32 characters for HS256 security`);
      }
    }

    // Load provider keys from DB (encrypted) into process.env — BEFORE any provider client import
    const { loadProviderKeys } = await import('@/lib/config/load-provider-keys');
    await loadProviderKeys();

    // Load infrastructure config from platform_settings (DB-first, env fallback)
    const { loadInfraConfig } = await import('@twicely/config/infra-config');
    await loadInfraConfig();

    const { initListerWorker } = await import('@twicely/crosslister/queue/worker-init');
    await initListerWorker();

    const { registerAffiliatePayoutJob } = await import('@twicely/jobs/affiliate-payout-cron');
    await registerAffiliatePayoutJob();

    const { registerAffiliateFraudScanJob } = await import('@twicely/jobs/affiliate-fraud-scan');
    await registerAffiliateFraudScanJob();

    // Start offer expiry worker — processes delayed offer expiration jobs
    await import('@twicely/jobs/offer-expiry');

    // In development, drain stale delayed jobs from local-transaction queues.
    // These accumulate in Valkey across dev server restarts and trigger
    // "transaction not found" warnings when workers process orphaned jobs.
    if (process.env.NODE_ENV !== 'production') {
      const { drainLocalTransactionQueues } = await import('@twicely/jobs/drain-dev-queues');
      await drainLocalTransactionQueues();
    }

    // Start local-transaction workers — QR escrow, safety, meetup, scheduling
    await import('@twicely/jobs/local-auto-cancel');
    await import('@twicely/jobs/local-escrow-release');
    await import('@twicely/jobs/local-noshow-check');
    await import('@twicely/jobs/local-safety-timer');
    await import('@twicely/jobs/local-meetup-reminder');
    await import('@twicely/jobs/local-fraud-noshow-relist');
    await import('@twicely/jobs/local-schedule-nudge');
    await import('@twicely/jobs/local-day-of-confirmation-timeout');

    // Install centralized SIGTERM/SIGINT handlers AFTER all workers are created.
    // Each createWorker() call auto-registers its worker; worker-init.ts registers
    // intervals. This single handler replaces 16+ individual process.on('SIGTERM')
    // calls that were exceeding Node.js MaxListeners default of 10.
    const { installShutdownHandlers } = await import('@twicely/jobs/shutdown-registry');
    installShutdownHandlers();
  }
}
