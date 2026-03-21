/**
 * Seed: Provider Adapters (F1.1)
 * 17 built-in adapters: 9 infrastructure + 8 crosslister channels.
 */
import { db } from '@twicely/db';
import { providerAdapter } from '@twicely/db/schema';
import { createId } from '@paralleldrive/cuid2';

interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'secret' | 'select';
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
  defaultValue?: string | number | boolean;
}

type ServiceType = 'EMAIL' | 'STORAGE' | 'SEARCH' | 'PAYMENTS' | 'SHIPPING' | 'REALTIME' | 'CACHE' | 'CROSSLISTER';

interface AdapterDef {
  serviceType: ServiceType; code: string; name: string; description: string;
  docsUrl: string; isBuiltIn: true; sortOrder: number; configSchemaJson: ConfigField[];
}

const INFRA_ADAPTERS: AdapterDef[] = [
  {
    serviceType: 'EMAIL', code: 'resend', name: 'Resend', sortOrder: 10,
    description: 'Transactional and marketing email via Resend + React Email',
    docsUrl: 'https://resend.com/docs', isBuiltIn: true,
    configSchemaJson: [
      { key: 'apiKey', label: 'API Key', type: 'secret', required: true, placeholder: 're_...' },
      { key: 'defaultFromEmail', label: 'From Email', type: 'string', required: true, placeholder: 'noreply@twicely.co' },
      { key: 'defaultFromName', label: 'From Name', type: 'string', defaultValue: 'Twicely' },
    ],
  },
  {
    serviceType: 'STORAGE', code: 'cloudflare-r2', name: 'Cloudflare R2', sortOrder: 20,
    description: 'S3-compatible object storage for images, assets, and exports',
    docsUrl: 'https://developers.cloudflare.com/r2/', isBuiltIn: true,
    configSchemaJson: [
      { key: 'accountId', label: 'Account ID', type: 'string', required: true },
      { key: 'accessKeyId', label: 'Access Key ID', type: 'secret', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'secret', required: true },
      { key: 'bucketName', label: 'Bucket Name', type: 'string', required: true, placeholder: 'twicely-assets' },
      { key: 'publicUrl', label: 'Public URL', type: 'string', placeholder: 'https://assets.twicely.co' },
    ],
  },
  {
    serviceType: 'SEARCH', code: 'typesense', name: 'Typesense', sortOrder: 30,
    description: 'Full-text search engine for listings, categories, and stores',
    docsUrl: 'https://typesense.org/docs/', isBuiltIn: true,
    configSchemaJson: [
      { key: 'host', label: 'Host', type: 'string', required: true, placeholder: 'search.twicely.co' },
      { key: 'port', label: 'Port', type: 'number', required: true, defaultValue: 443 },
      { key: 'protocol', label: 'Protocol', type: 'select', required: true, defaultValue: 'https', options: [{ label: 'HTTPS', value: 'https' }, { label: 'HTTP', value: 'http' }] },
      { key: 'apiKey', label: 'API Key', type: 'secret', required: true },
    ],
  },
  {
    serviceType: 'PAYMENTS', code: 'stripe', name: 'Stripe', sortOrder: 40,
    description: 'Payment processing, Connect payouts, and subscription billing',
    docsUrl: 'https://stripe.com/docs', isBuiltIn: true,
    configSchemaJson: [
      { key: 'publishableKey', label: 'Publishable Key', type: 'string', required: true, placeholder: 'pk_live_...' },
      { key: 'secretKey', label: 'Secret Key', type: 'secret', required: true, placeholder: 'sk_live_...' },
      { key: 'webhookSecret', label: 'Webhook Signing Secret', type: 'secret', required: true, placeholder: 'whsec_...' },
      { key: 'connectClientId', label: 'Connect Client ID', type: 'string', placeholder: 'ca_...' },
    ],
  },
  {
    serviceType: 'SHIPPING', code: 'shippo', name: 'Shippo', sortOrder: 50,
    description: 'Multi-carrier shipping rates, label generation, and tracking',
    docsUrl: 'https://goshippo.com/docs/', isBuiltIn: true,
    configSchemaJson: [
      { key: 'apiKeyLive', label: 'Live API Token', type: 'secret', required: true, placeholder: 'shippo_live_...' },
      { key: 'apiKeyTest', label: 'Test API Token', type: 'secret', placeholder: 'shippo_test_...' },
      { key: 'testMode', label: 'Test Mode', type: 'boolean', defaultValue: false, helpText: 'Use test API token instead of live' },
    ],
  },
  {
    serviceType: 'REALTIME', code: 'centrifugo', name: 'Centrifugo', sortOrder: 60,
    description: 'Real-time messaging server for notifications and live updates',
    docsUrl: 'https://centrifugal.dev/docs/', isBuiltIn: true,
    configSchemaJson: [
      { key: 'apiUrl', label: 'API URL', type: 'string', required: true, placeholder: 'http://localhost:8000/api' },
      { key: 'apiKey', label: 'API Key', type: 'secret', required: true },
      { key: 'tokenHmacSecret', label: 'Token HMAC Secret', type: 'secret', required: true, helpText: 'Used to sign JWT connection tokens' },
    ],
  },
  {
    serviceType: 'CACHE', code: 'valkey', name: 'Valkey', sortOrder: 70,
    description: 'In-memory cache and BullMQ job queue backend',
    docsUrl: 'https://valkey.io/docs/', isBuiltIn: true,
    configSchemaJson: [
      { key: 'host', label: 'Host', type: 'string', required: true, placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', required: true, defaultValue: 6379 },
      { key: 'password', label: 'Password', type: 'secret', helpText: 'Leave blank if no auth required' },
      { key: 'tls', label: 'TLS Enabled', type: 'boolean', defaultValue: false },
      { key: 'db', label: 'Database Index', type: 'number', defaultValue: 0 },
    ],
  },
  {
    serviceType: 'CACHE', code: 'bullmq', name: 'BullMQ', sortOrder: 80,
    description: 'Background job processing and task scheduling via Valkey',
    docsUrl: 'https://docs.bullmq.io/', isBuiltIn: true,
    configSchemaJson: [
      { key: 'valkeyInstanceName', label: 'Valkey Instance', type: 'string', required: true, helpText: 'Name of the Valkey provider instance to use as backend' },
      { key: 'defaultConcurrency', label: 'Default Concurrency', type: 'number', defaultValue: 5 },
      { key: 'prefix', label: 'Queue Prefix', type: 'string', defaultValue: 'twicely' },
    ],
  },
  {
    serviceType: 'STORAGE', code: 'postgresql', name: 'PostgreSQL', sortOrder: 90,
    description: 'Primary relational database via Neon (serverless Postgres)',
    docsUrl: 'https://neon.tech/docs/', isBuiltIn: true,
    configSchemaJson: [
      { key: 'connectionString', label: 'Connection String', type: 'secret', required: true, placeholder: 'postgresql://user:pass@host/db' },
      { key: 'poolSize', label: 'Pool Size', type: 'number', defaultValue: 20 },
      { key: 'sslMode', label: 'SSL Mode', type: 'select', defaultValue: 'require', options: [{ label: 'Require', value: 'require' }, { label: 'Prefer', value: 'prefer' }, { label: 'Disable', value: 'disable' }] },
    ],
  },
];

const CROSSLISTER_ADAPTERS: AdapterDef[] = [
  {
    serviceType: 'CROSSLISTER', code: 'ebay', name: 'eBay', sortOrder: 100,
    description: 'eBay marketplace — OAuth app credentials for listing sync and order import',
    docsUrl: 'https://developer.ebay.com/develop/apis', isBuiltIn: true,
    configSchemaJson: [
      { key: 'appId', label: 'App ID (Client ID)', type: 'secret', required: true, placeholder: 'Production App ID' },
      { key: 'certId', label: 'Cert ID (Client Secret)', type: 'secret', required: true },
      { key: 'devId', label: 'Dev ID', type: 'secret', required: true },
      { key: 'ruName', label: 'RuName (Redirect URL Name)', type: 'string', required: true, helpText: 'OAuth redirect name from eBay developer portal' },
      { key: 'sandbox', label: 'Sandbox Mode', type: 'boolean', defaultValue: false, helpText: 'Use eBay sandbox environment for testing' },
    ],
  },
  {
    serviceType: 'CROSSLISTER', code: 'poshmark', name: 'Poshmark', sortOrder: 110,
    description: 'Poshmark marketplace — API credentials for listing sync',
    docsUrl: 'https://poshmark.com/developer', isBuiltIn: true,
    configSchemaJson: [
      { key: 'apiKey', label: 'API Key', type: 'secret', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'secret', required: true },
    ],
  },
  {
    serviceType: 'CROSSLISTER', code: 'mercari', name: 'Mercari', sortOrder: 120,
    description: 'Mercari marketplace — API credentials for listing sync',
    docsUrl: 'https://www.mercari.com', isBuiltIn: true,
    configSchemaJson: [
      { key: 'apiKey', label: 'API Key', type: 'secret', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'secret', required: true },
    ],
  },
  {
    serviceType: 'CROSSLISTER', code: 'depop', name: 'Depop', sortOrder: 130,
    description: 'Depop marketplace — API credentials for listing sync',
    docsUrl: 'https://www.depop.com', isBuiltIn: true,
    configSchemaJson: [
      { key: 'apiKey', label: 'API Key', type: 'secret', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'secret', required: true },
    ],
  },
  {
    serviceType: 'CROSSLISTER', code: 'fb-marketplace', name: 'Facebook Marketplace', sortOrder: 140,
    description: 'Facebook Marketplace — Meta app credentials for Commerce API',
    docsUrl: 'https://developers.facebook.com/docs/commerce-platform/', isBuiltIn: true,
    configSchemaJson: [
      { key: 'appId', label: 'Meta App ID', type: 'string', required: true },
      { key: 'appSecret', label: 'Meta App Secret', type: 'secret', required: true },
      { key: 'catalogId', label: 'Commerce Catalog ID', type: 'string', helpText: 'Facebook Commerce catalog for syncing listings' },
    ],
  },
  {
    serviceType: 'CROSSLISTER', code: 'etsy', name: 'Etsy', sortOrder: 150,
    description: 'Etsy marketplace — OAuth app credentials for listing sync',
    docsUrl: 'https://developers.etsy.com/documentation/', isBuiltIn: true,
    configSchemaJson: [
      { key: 'apiKey', label: 'API Key (Keystring)', type: 'secret', required: true },
      { key: 'sharedSecret', label: 'Shared Secret', type: 'secret', required: true },
    ],
  },
  {
    serviceType: 'CROSSLISTER', code: 'grailed', name: 'Grailed', sortOrder: 160,
    description: 'Grailed marketplace — API credentials for listing sync',
    docsUrl: 'https://www.grailed.com', isBuiltIn: true,
    configSchemaJson: [
      { key: 'apiKey', label: 'API Key', type: 'secret', required: true },
    ],
  },
  {
    serviceType: 'CROSSLISTER', code: 'therealreal', name: 'The RealReal', sortOrder: 170,
    description: 'The RealReal — API credentials for consignment sync',
    docsUrl: 'https://www.therealreal.com', isBuiltIn: true,
    configSchemaJson: [
      { key: 'apiKey', label: 'API Key', type: 'secret', required: true },
      { key: 'consignorId', label: 'Consignor ID', type: 'string', helpText: 'Your consignor account identifier' },
    ],
  },
];

const ALL_ADAPTERS = [...INFRA_ADAPTERS, ...CROSSLISTER_ADAPTERS];

export async function seedProviderAdapters(): Promise<void> {
  for (const adapter of ALL_ADAPTERS) {
    await db.insert(providerAdapter).values({
      id: createId(),
      ...adapter,
      enabled: true,
    }).onConflictDoUpdate({
      target: [providerAdapter.serviceType, providerAdapter.code],
      set: {
        configSchemaJson: adapter.configSchemaJson,
        description: adapter.description,
        docsUrl: adapter.docsUrl,
        updatedAt: new Date(),
      },
    });
  }
}
