/**
 * Next.js instrumentation hook — runs once on application startup.
 * Used to initialize in-process BullMQ workers (Railway single-container model).
 * Source: F3.1 install prompt §3.11; Decision #62 (Railway deployment)
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate required environment variables at startup
    const required = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'ENCRYPTION_KEY', 'PROVIDER_ENCRYPTION_KEY'];
    const missing = required.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Load provider keys from DB (encrypted) into process.env — BEFORE any provider client import
    const { loadProviderKeys } = await import('@/lib/config/load-provider-keys');
    await loadProviderKeys();

    // Load infrastructure config from platform_settings (DB-first, env fallback)
    const { loadInfraConfig } = await import('@/lib/config/infra-config');
    await loadInfraConfig();

    const { initListerWorker } = await import('@/lib/crosslister/queue/worker-init');
    initListerWorker();

    const { registerAffiliatePayoutJob } = await import('@/lib/jobs/affiliate-payout-cron');
    await registerAffiliatePayoutJob();

    const { registerAffiliateFraudScanJob } = await import('@/lib/jobs/affiliate-fraud-scan');
    await registerAffiliateFraudScanJob();

    // Start offer expiry worker — processes delayed offer expiration jobs
    await import('@/lib/jobs/offer-expiry');

    // Start local-transaction workers — QR escrow, safety, meetup, scheduling
    await import('@/lib/jobs/local-auto-cancel');
    await import('@/lib/jobs/local-escrow-release');
    await import('@/lib/jobs/local-noshow-check');
    await import('@/lib/jobs/local-safety-timer');
    await import('@/lib/jobs/local-meetup-reminder');
    await import('@/lib/jobs/local-fraud-noshow-relist');
    await import('@/lib/jobs/local-schedule-nudge');
    await import('@/lib/jobs/local-day-of-confirmation-timeout');
  }
}
