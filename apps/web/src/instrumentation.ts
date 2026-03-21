/**
 * Next.js instrumentation hook — runs once on application startup.
 * Used to initialize in-process BullMQ workers (Railway single-container model).
 * Source: F3.1 install prompt §3.11; Decision #62 (Railway deployment)
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Load infrastructure config from platform_settings FIRST (DB-first, env fallback)
    const { loadInfraConfig } = await import('@/lib/config/infra-config');
    await loadInfraConfig();

    const { initListerWorker } = await import('@/lib/crosslister/queue/worker-init');
    initListerWorker();

    const { registerAffiliatePayoutJob } = await import('@/lib/jobs/affiliate-payout-cron');
    await registerAffiliatePayoutJob();

    const { registerAffiliateFraudScanJob } = await import('@/lib/jobs/affiliate-fraud-scan');
    await registerAffiliateFraudScanJob();
  }
}
