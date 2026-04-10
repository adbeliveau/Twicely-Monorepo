/**
 * v3.2 Platform Settings — Extended Categories (Part 2)
 * Jobs, Infrastructure, Geocoding, Rate Limiting, Payments, Comms,
 * Extension, Tier-C, Auth, Accounting, Helpdesk crons, Cleanup, Trust, Discovery.
 * Split from v32-platform-settings-extended.ts to stay under 300 lines.
 */

import type { PlatformSettingSeed } from './v32-platform-settings';

export const V32_EXTENDED_SETTINGS_PART2: PlatformSettingSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // JOBS — Cron schedules and scheduler settings
  // Changes take effect on next server restart.
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'jobs.cron.orders.pattern', value: '0 * * * *', type: 'string', category: 'jobs', description: 'Cron pattern for auto-completing delivered orders (default: every hour at :00)' },
  { key: 'jobs.cron.returns.pattern', value: '10 * * * *', type: 'string', category: 'jobs', description: 'Cron pattern for auto-approving overdue returns (default: every hour at :10)' },
  { key: 'jobs.cron.shipping.pattern', value: '20 * * * *', type: 'string', category: 'jobs', description: 'Cron pattern for scanning shipping exceptions (default: every hour at :20)' },
  { key: 'jobs.cron.health.pattern', value: '*/5 * * * *', type: 'string', category: 'jobs', description: 'Cron pattern for system health checks (default: every 5 minutes)' },
  { key: 'jobs.cron.vacation.pattern', value: '0 0 * * *', type: 'string', category: 'jobs', description: 'Cron pattern for ending expired vacation modes (default: midnight UTC)' },
  { key: 'jobs.cron.sellerScoreRecalc.pattern', value: '0 3 * * *', type: 'string', category: 'jobs', description: 'Cron pattern for seller score recalculation (default: 3 AM UTC)' },
  { key: 'jobs.cron.accountingSync.pattern', value: '0 2 * * *', type: 'string', category: 'jobs', description: 'Cron pattern for accounting sync job (default: 2 AM UTC)' },
  { key: 'jobs.scheduler.tickIntervalMs', value: 5000, type: 'number', category: 'jobs', description: 'Crosslister scheduler tick interval in milliseconds (default: 5000). Restart required.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE — Service connection URLs
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'infrastructure.valkey.host', value: '127.0.0.1', type: 'string', category: 'infrastructure', description: 'Valkey host (matches VALKEY_HOST env var — restart required to reconnect)' },
  { key: 'infrastructure.valkey.port', value: 6379, type: 'number', category: 'infrastructure', description: 'Valkey port (matches VALKEY_PORT env var — restart required to reconnect)' },
  { key: 'infrastructure.typesense.url', value: 'http://127.0.0.1:8108', type: 'string', category: 'infrastructure', description: 'Typesense base URL (matches TYPESENSE_URL env var — restart required)' },
  { key: 'infrastructure.centrifugo.apiUrl', value: 'http://127.0.0.1:8000', type: 'string', category: 'infrastructure', description: 'Centrifugo API URL (matches CENTRIFUGO_API_URL env var — restart required)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // GEOCODING — Address lookup & autocomplete
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'geocoding.enabled', value: true, type: 'boolean', category: 'infrastructure', description: 'Master switch for geocoding' },
  { key: 'geocoding.cacheEnabled', value: true, type: 'boolean', category: 'infrastructure', description: 'Cache geocoding results to avoid repeat lookups' },
  { key: 'geocoding.cacheTtlDays', value: 365, type: 'number', category: 'infrastructure', description: 'How long to cache geocoded addresses (days)' },
  { key: 'geocoding.confidenceThreshold', value: 0.6, type: 'number', category: 'infrastructure', description: 'Minimum confidence score to accept a geocoding result (0–1)' },
  { key: 'geocoding.batchSizeLimit', value: 500, type: 'number', category: 'infrastructure', description: 'Max addresses per batch geocoding job' },
  { key: 'geocoding.batchDelayMs', value: 50, type: 'number', category: 'infrastructure', description: 'Delay between individual requests in a batch (ms)' },
  { key: 'geocoding.defaultCountry', value: 'US', type: 'string', category: 'infrastructure', description: 'Default country code for geocoding bias' },
  { key: 'geocoding.autocompleteEnabled', value: true, type: 'boolean', category: 'infrastructure', description: 'Enable address autocomplete in forms' },
  { key: 'geocoding.autocompleteMinChars', value: 3, type: 'number', category: 'infrastructure', description: 'Minimum characters before triggering autocomplete' },
  { key: 'geocoding.autocompleteDebounceMs', value: 300, type: 'number', category: 'infrastructure', description: 'Debounce delay for autocomplete requests (ms)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // RATE LIMITING — Request throttles and lockout policy
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'rateLimit.enabled', value: true, type: 'boolean', category: 'security', description: 'Master switch for rate limiting' },
  { key: 'rateLimit.guestSearchPerMinute', value: 60, type: 'number', category: 'security', description: 'Guest search rate limit per minute' },
  { key: 'rateLimit.loginMaxAttempts', value: 5, type: 'number', category: 'security', description: 'Failed login attempts before lockout' },
  { key: 'rateLimit.loginLockoutMinutes', value: 15, type: 'number', category: 'security', description: 'Lockout duration after max failed attempts (minutes)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS — Dispute fees, chargeback handling, reconciliation
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'payments.disputeFilingFeeCents', value: 0, type: 'cents', category: 'payments', description: 'Fee charged when dispute is filed (0 = free to file)' },
  { key: 'payments.disputeSellerFeeCents', value: 2000, type: 'cents', category: 'payments', description: 'Fee charged to seller if dispute is lost ($20)' },
  { key: 'payments.chargebackReversalCreditCents', value: 1500, type: 'cents', category: 'payments', description: 'Credit issued if chargeback is reversed ($15)' },
  { key: 'payments.waiveFirstDisputeFee', value: false, type: 'boolean', category: 'payments', description: 'Waive fee for seller first dispute' },
  { key: 'payments.disputeFeeWaiverLimit', value: 1, type: 'number', category: 'payments', description: 'Max disputes to waive per seller per year' },
  { key: 'payments.reconciliationFrequency', value: 'daily', type: 'string', category: 'payments', description: 'How often to run reconciliation (hourly, daily, weekly)' },
  { key: 'payments.reconciliationTimeUtc', value: '02:00', type: 'string', category: 'payments', description: 'UTC time to run daily reconciliation' },
  { key: 'payments.autoResolveSmallDiscrepancies', value: true, type: 'boolean', category: 'payments', description: 'Auto-resolve discrepancies under threshold' },
  { key: 'payments.autoResolveThresholdCents', value: 100, type: 'cents', category: 'payments', description: 'Max discrepancy to auto-resolve ($1)' },
  { key: 'payments.ledgerRetentionYears', value: 7, type: 'number', category: 'payments', description: 'Years to retain ledger entries' },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMUNICATIONS — Newsletter and marketing opt-in
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'newsletter.enabled', value: true, type: 'boolean' as const, category: 'comms', description: 'Enable newsletter subscription form on homepage and footer' },
  { key: 'newsletter.doubleOptIn', value: true, type: 'boolean' as const, category: 'comms', description: 'Require email confirmation before activating newsletter subscriptions' },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTENSION — Browser extension feature flags and configuration (H1.1)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'extension.enabled', value: true, type: 'boolean' as const, category: 'extension', description: 'Extension enabled' },
  { key: 'extension.registrationEnabled', value: true, type: 'boolean' as const, category: 'extension', description: 'Extension registration enabled' },
  { key: 'extension.heartbeatIntervalMinutes', value: 5, type: 'number' as const, category: 'extension', description: 'Heartbeat interval (minutes)' },
  { key: 'extension.sessionTokenExpiryDays', value: 30, type: 'number' as const, category: 'extension', description: 'Extension token expiry (days)' },
  { key: 'extension.version.minimum', value: '0.1.0', type: 'string' as const, category: 'extension', description: 'Minimum supported extension version' },
  { key: 'extension.version.latest', value: '0.1.0', type: 'string' as const, category: 'extension', description: 'Latest extension version' },
  { key: 'extension.registrationTokenExpiryMinutes', value: 5, type: 'number' as const, category: 'extension', description: 'Registration token expiry (minutes)' },
  { key: 'extension.scrapeCacheTtlSeconds', value: 3600, type: 'number' as const, category: 'extension', description: 'Scrape cache TTL in Valkey (seconds)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER-C CONNECTORS — Anti-detection delay configuration (H4.x)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'crosslister.tierC.delayMinMs', value: 2000, type: 'number' as const, category: 'crosslister', description: 'Tier-C connector minimum human-like delay (ms)' },
  { key: 'crosslister.tierC.delayMaxMs', value: 8000, type: 'number' as const, category: 'crosslister', description: 'Tier-C connector maximum human-like delay (ms)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT FIX — Round 2 missing seeds
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'storefront.pages.maxPower', value: 5, type: 'number' as const, category: 'storefront', description: 'Max storefront pages for Power tier' },
  { key: 'storefront.pages.maxEnterprise', value: 20, type: 'number' as const, category: 'storefront', description: 'Max storefront pages for Enterprise tier' },
  { key: 'discovery.browsingHistory.maxItems', value: 50, type: 'number' as const, category: 'discovery', description: 'Max browsing history items per user (FIFO)' },
  { key: 'admin.customRoles.maxCount', value: 20, type: 'number' as const, category: 'admin', description: 'Max number of active custom staff roles' },
  { key: 'privacy.dataExportRateLimitHours', value: 24, type: 'number' as const, category: 'privacy', description: 'Minimum hours between user data export requests' },
  { key: 'privacy.dataExport.expiryDays', value: 7, type: 'number' as const, category: 'privacy', description: 'Days before expired data export files are purged' },
  { key: 'privacy.dataExport.downloadUrlTtlHours', value: 24, type: 'number' as const, category: 'privacy', description: 'Pre-signed download URL TTL in hours' },
  { key: 'rateLimit.staffLoginIpMaxAttempts', value: 20, type: 'number' as const, category: 'security', description: 'Max failed staff login attempts per IP before lockout' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRUST — AI Authentication (G10.2)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'trust.authentication.aiEnabled', value: false, type: 'boolean' as const, category: 'trust', description: 'Enable AI authentication tier (requires active provider contract)' },
  { key: 'trust.authentication.aiFeeCents', value: 1999, type: 'cents' as const, category: 'trust', description: 'Total fee for AI authentication ($19.99)' },
  { key: 'trust.authentication.aiProviderName', value: 'entrupy', type: 'string' as const, category: 'trust', description: 'Active AI authentication provider name' },
  { key: 'trust.authentication.aiProviderApiUrl', value: 'https://api.entrupy.com/v1', type: 'string' as const, category: 'trust', description: 'AI authentication provider API base URL' },
  { key: 'trust.authentication.aiProviderWebhookSecret', value: '', type: 'string' as const, category: 'trust', description: 'Webhook signing secret for AI auth provider callbacks' },
  { key: 'trust.authentication.aiMaxTurnaroundHours', value: 24, type: 'number' as const, category: 'trust', description: 'Maximum expected turnaround for AI authentication (hours)' },
  { key: 'trust.authentication.aiSupportedCategories', value: ['HANDBAGS', 'WATCHES', 'SNEAKERS', 'TRADING_CARDS'], type: 'array' as const, category: 'trust', description: 'Item categories eligible for AI authentication' },
  { key: 'trust.authentication.offerThresholdCents', value: 50000, type: 'cents' as const, category: 'trust', description: 'Show auth option for items >= this amount' },
  { key: 'trust.authentication.buyerFeeCents', value: 1999, type: 'cents' as const, category: 'trust', description: 'Buyer share of AI auth fee when authentic' },
  { key: 'trust.authentication.sellerFeeCents', value: 1999, type: 'cents' as const, category: 'trust', description: 'Seller share of AI auth fee when authentic' },
  { key: 'trust.authentication.expertFeeCents', value: 3999, type: 'cents' as const, category: 'trust', description: 'Expert human auth fee (standard items)' },
  { key: 'trust.authentication.expertHighValueFeeCents', value: 6999, type: 'cents' as const, category: 'trust', description: 'Expert human auth fee (high-value items)' },
  { key: 'trust.authentication.mandatoryAboveCents', value: 0, type: 'cents' as const, category: 'trust', description: 'Mandatory auth above this price (0 = never)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTING INTEGRATIONS — G10.3
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'accounting.quickbooks.enabled', value: false, type: 'boolean' as const, category: 'accounting', description: 'Enable QuickBooks Online integration' },
  { key: 'accounting.quickbooks.clientId', value: '', type: 'string' as const, category: 'accounting', description: 'QuickBooks OAuth client ID' },
  { key: 'accounting.quickbooks.clientSecret', value: '', type: 'string' as const, category: 'accounting', description: 'QuickBooks OAuth client secret' },
  { key: 'accounting.quickbooks.apiUrl', value: 'https://quickbooks.api.intuit.com', type: 'string' as const, category: 'accounting', description: 'QuickBooks API base URL' },
  { key: 'accounting.quickbooks.tokenUrl', value: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', type: 'string' as const, category: 'accounting', description: 'QuickBooks OAuth token endpoint' },
  { key: 'accounting.quickbooks.authUrl', value: 'https://appcenter.intuit.com/connect/oauth2', type: 'string' as const, category: 'accounting', description: 'QuickBooks OAuth authorization URL' },
  { key: 'accounting.quickbooks.scopes', value: 'com.intuit.quickbooks.accounting', type: 'string' as const, category: 'accounting', description: 'QuickBooks OAuth scopes' },
  { key: 'accounting.xero.enabled', value: false, type: 'boolean' as const, category: 'accounting', description: 'Enable Xero integration' },
  { key: 'accounting.xero.clientId', value: '', type: 'string' as const, category: 'accounting', description: 'Xero OAuth client ID' },
  { key: 'accounting.xero.clientSecret', value: '', type: 'string' as const, category: 'accounting', description: 'Xero OAuth client secret' },
  { key: 'accounting.xero.apiUrl', value: 'https://api.xero.com/api.xro/2.0', type: 'string' as const, category: 'accounting', description: 'Xero API base URL' },
  { key: 'accounting.xero.tokenUrl', value: 'https://identity.xero.com/connect/token', type: 'string' as const, category: 'accounting', description: 'Xero OAuth token endpoint' },
  { key: 'accounting.xero.authUrl', value: 'https://login.xero.com/identity/connect/authorize', type: 'string' as const, category: 'accounting', description: 'Xero OAuth authorization URL' },
  { key: 'accounting.xero.scopes', value: 'openid profile email accounting.transactions', type: 'string' as const, category: 'accounting', description: 'Xero OAuth scopes' },
  { key: 'accounting.sync.defaultFrequency', value: 'DAILY', type: 'string' as const, category: 'accounting', description: 'Default sync frequency for new integrations' },
  { key: 'accounting.sync.maxRetries', value: 3, type: 'number' as const, category: 'accounting', description: 'Max retry attempts for failed sync operations' },
  { key: 'accounting.sync.batchSize', value: 50, type: 'number' as const, category: 'accounting', description: 'Number of records to sync per batch' },

  // Helpdesk cron patterns
  { key: 'helpdesk.cron.autoClose.pattern', value: '*/15 * * * *', type: 'string' as const, category: 'helpdesk', description: 'Cron pattern for helpdesk auto-close job (default: every 15 min)' },
  { key: 'helpdesk.cron.slaCheck.pattern', value: '*/5 * * * *', type: 'string' as const, category: 'helpdesk', description: 'Cron pattern for helpdesk SLA check job (default: every 5 min)' },
  { key: 'helpdesk.cron.csatSend.pattern', value: '*/5 * * * *', type: 'string' as const, category: 'helpdesk', description: 'Cron pattern for helpdesk CSAT send job (default: every 5 min)' },
  { key: 'helpdesk.cron.retentionPurge.pattern', value: '0 4 * * *', type: 'string' as const, category: 'helpdesk', description: 'Cron pattern for helpdesk retention purge job (default: 4 AM UTC daily)' },

  // Helpdesk batch sizes
  { key: 'helpdesk.autoClose.batchSize', value: 100, type: 'number' as const, category: 'helpdesk', description: 'Max cases per auto-close run' },
  { key: 'helpdesk.slaCheck.batchSize', value: 500, type: 'number' as const, category: 'helpdesk', description: 'Max active cases checked per SLA check run' },
  { key: 'helpdesk.csat.batchSize', value: 50, type: 'number' as const, category: 'helpdesk', description: 'Max CSAT surveys sent per run' },
  { key: 'helpdesk.retentionPurge.batchSize', value: 200, type: 'number' as const, category: 'helpdesk', description: 'Max cases purged per retention purge run' },

  // Cleanup batch sizes
  { key: 'cleanup.dataPurge.exportBatchSize', value: 500, type: 'number' as const, category: 'cleanup', description: 'Max expired data exports purged per run' },
  { key: 'cleanup.auditArchive.batchSize', value: 10000, type: 'number' as const, category: 'cleanup', description: 'Max audit events archived per run' },

  // ─── Buyer Protection (canonical §10.5) ────────────────────────────────────
  { key: 'trust.protection.defaultWindowDays', value: 30, type: 'number' as const, category: 'trust', description: 'Standard buyer protection claim window (days)' },
  { key: 'trust.protection.counterfeitWindowDays', value: 60, type: 'number' as const, category: 'trust', description: 'Extended claim window for counterfeit claims (days)' },
  { key: 'trust.protection.sellerResponseDays', value: 3, type: 'number' as const, category: 'trust', description: 'Business days for seller to respond to a claim' },
  { key: 'trust.protection.platformReviewHours', value: 48, type: 'number' as const, category: 'trust', description: 'Hours for platform to review escalated claims' },
  { key: 'trust.protection.appealWindowDays', value: 30, type: 'number' as const, category: 'trust', description: 'Days after resolution to file an appeal' },
  { key: 'trust.protection.defaultMaxCoverageCents', value: 500000, type: 'cents' as const, category: 'trust', description: 'Default max coverage per claim ($5,000)' },
  { key: 'trust.protection.autoApproveThresholdCents', value: 2500, type: 'cents' as const, category: 'trust', description: 'Auto-approve claims under this amount if seller does not respond ($25)' },

  // ─── Discovery — Search & Price Alerts (canonical §11.1, §11.3) ────────────
  { key: 'discovery.search.maxPageSize', value: 48, type: 'number' as const, category: 'discovery', description: 'Maximum search results per page' },
  { key: 'discovery.priceAlert.defaultExpiryDays', value: 90, type: 'number' as const, category: 'discovery', description: 'Default price alert expiration (days)' },
  { key: 'discovery.priceAlert.categoryAlertsEnabled', value: true, type: 'boolean' as const, category: 'discovery', description: 'Enable category-wide price alerts' },
  { key: 'discovery.priceAlert.categoryAlertMaxPerUser', value: 20, type: 'number' as const, category: 'discovery', description: 'Max category alerts per user' },
  { key: 'discovery.priceAlert.immediateLimit', value: 10, type: 'number' as const, category: 'discovery', description: 'Max immediate alert notifications sent per day' },

  // ─── Payments — Disputes & Reconciliation (canonical §13.1, §13.2) ─────────
  { key: 'payments.chargebackFeeCents', value: 1500, type: 'cents' as const, category: 'payments', description: 'Fee charged for chargebacks ($15)' },
  { key: 'payments.generateDailyReports', value: true, type: 'boolean' as const, category: 'payments', description: 'Auto-generate daily financial reports' },

  // ─── Fulfillment — Returns (canonical §9.3) ────────────────────────────────
  { key: 'fulfillment.returns.returnShipByDays', value: 7, type: 'number' as const, category: 'fulfillment', description: 'Days buyer has to ship return after label issued — canonical §9.3' },
  { key: 'fulfillment.returns.autoApproveUnderCents', value: 1000, type: 'cents' as const, category: 'fulfillment', description: 'Auto-approve returns under this amount if seller does not respond ($10) — canonical §9.3' },
  { key: 'fulfillment.returns.maxReturnsPerBuyerPerMonth', value: 10, type: 'number' as const, category: 'fulfillment', description: 'Flag serial returners above this threshold — canonical §9.3' },

  // ─── Fulfillment — Shipping Carriers (canonical §9.1) ──────────────────────
  { key: 'fulfillment.shipping.enabledCarriers', value: ['USPS', 'UPS', 'FedEx'], type: 'array' as const, category: 'fulfillment', description: 'Carriers available for shipping labels — canonical §9.1' },

  // ─── Discovery — Market Index (canonical §11.4) ────────────────────────────
  { key: 'discovery.marketIndex.minSample', value: 10, type: 'number' as const, category: 'discovery', description: 'Min sales required for market index calculation — canonical §11.4' },
  { key: 'discovery.marketIndex.highConfidence', value: 50, type: 'number' as const, category: 'discovery', description: 'Min sales for HIGH confidence market index — canonical §11.4' },
  { key: 'discovery.marketIndex.lowConfidenceVisible', value: false, type: 'boolean' as const, category: 'discovery', description: 'Display LOW confidence indexes to users — canonical §11.4' },

  // ─── Finance Intelligence Projection (D4.IL) ──────────────────────────────
  { key: 'finance.projection.trailingDays', value: 90, type: 'number' as const, category: 'finance', description: 'Trailing lookback window (days) for all projection engine metrics' },
  { key: 'finance.projection.breakEvenMinMonths', value: 3, type: 'number' as const, category: 'finance', description: 'Min expense months needed for break-even calculation' },
  { key: 'finance.projection.batchSize', value: 50, type: 'number' as const, category: 'finance', description: 'Sellers processed per batch in nightly projection job' },

  // ─── Finance Trial (D4.T1) ────────────────────────────────────────────────
  { key: 'finance.trial.batchSize', value: 100, type: 'number' as const, category: 'finance', description: 'Max trial expirations processed per batch in nightly job' },
  { key: 'finance.trial.expiryWarningDays', value: 30, type: 'number' as const, category: 'finance', description: 'Days before trial expiry to send warning notification' },

  // ─── Finance Intelligence UI ──────────────────────────────────────────────
  { key: 'finance.intelligence.staleDaysThreshold', value: 60, type: 'number' as const, category: 'finance', description: 'Days of inactivity before a listing is considered stale/dead stock' },
];
