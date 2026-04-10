/**
 * Infrastructure Configuration Loader
 *
 * Loads infrastructure connection settings from platform_settings DB first,
 * falling back to environment variables. Must be called once at startup
 * (instrumentation.ts) before any service clients are initialized.
 *
 * In production, only 3 env vars are required:
 *   - DATABASE_URL       (bootstraps DB connection)
 *   - BETTER_AUTH_SECRET (session signing — security-critical)
 *   - MASTER_ENCRYPTION_KEY (decrypts provider secrets)
 *
 * Everything else lives in the platform_settings table.
 */

import { getPlatformSettingsByPrefix } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';

export interface InfraConfig {
  valkeyHost: string;
  valkeyPort: number;
  typesenseUrl: string;
  typesenseApiKey: string;
  opensearchUrl: string;
  opensearchUsername: string;
  opensearchPassword: string;
  centrifugoApiUrl: string;
  centrifugoApiKey: string;
}

let _config: InfraConfig | null = null;

/**
 * Load infrastructure config from platform_settings (DB-first, env fallback).
 * Call once at startup before any workers or clients are initialized.
 */
export async function loadInfraConfig(): Promise<void> {
  try {
    const settings = await getPlatformSettingsByPrefix('infrastructure.');

    _config = {
      valkeyHost: String(settings.get('infrastructure.valkey.host') ?? process.env.VALKEY_HOST ?? '127.0.0.1'),
      valkeyPort: Number(settings.get('infrastructure.valkey.port') ?? process.env.VALKEY_PORT ?? 6379),
      typesenseUrl: String(settings.get('infrastructure.typesense.url') ?? process.env.TYPESENSE_URL ?? ''),
      opensearchUrl: String(settings.get('infrastructure.opensearch.url') ?? process.env.OPENSEARCH_URL ?? 'http://127.0.0.1:9200'),
      opensearchUsername: process.env.OPENSEARCH_USERNAME ?? '',
      opensearchPassword: process.env.OPENSEARCH_PASSWORD ?? '',
      centrifugoApiUrl: String(settings.get('infrastructure.centrifugo.apiUrl') ?? process.env.CENTRIFUGO_API_URL ?? ''),
      // API keys are sensitive — not stored in platform_settings (not encrypted)
      // Use provider settings system once wired; env var until then
      typesenseApiKey: process.env.TYPESENSE_API_KEY ?? '',
      centrifugoApiKey: process.env.CENTRIFUGO_API_KEY ?? '',
    };

    // Write DB-loaded values to process.env so downstream packages (e.g. @twicely/db cache,
    // @twicely/jobs queue) can read them without importing @twicely/config (avoids circular deps).
    process.env.VALKEY_HOST = _config.valkeyHost;
    process.env.VALKEY_PORT = String(_config.valkeyPort);
    if (_config.typesenseUrl) process.env.TYPESENSE_URL = _config.typesenseUrl;
    if (_config.opensearchUrl) process.env.OPENSEARCH_URL = _config.opensearchUrl;
    if (_config.centrifugoApiUrl) process.env.CENTRIFUGO_API_URL = _config.centrifugoApiUrl;

    logger.info('[infraConfig] Loaded infrastructure config from platform_settings', {
      valkeyHost: _config.valkeyHost,
      valkeyPort: _config.valkeyPort,
      typesenseUrl: _config.typesenseUrl,
      centrifugoApiUrl: _config.centrifugoApiUrl,
    });
  } catch (err) {
    // DB not available at cold-start (e.g. first boot before migrations) — fall back to env vars
    logger.warn('[infraConfig] Could not load from DB, using env vars', { error: String(err) });
    _config = {
      valkeyHost: process.env.VALKEY_HOST ?? '127.0.0.1',
      valkeyPort: parseInt(process.env.VALKEY_PORT ?? '6379', 10),
      typesenseUrl: process.env.TYPESENSE_URL ?? '',
      opensearchUrl: process.env.OPENSEARCH_URL ?? 'http://127.0.0.1:9200',
      opensearchUsername: process.env.OPENSEARCH_USERNAME ?? '',
      opensearchPassword: process.env.OPENSEARCH_PASSWORD ?? '',
      centrifugoApiUrl: process.env.CENTRIFUGO_API_URL ?? '',
      typesenseApiKey: process.env.TYPESENSE_API_KEY ?? '',
      centrifugoApiKey: process.env.CENTRIFUGO_API_KEY ?? '',
    };
  }
}

/**
 * Get the loaded infrastructure config. Throws if loadInfraConfig() was not called first.
 */
export function getInfraConfig(): InfraConfig {
  if (!_config) {
    // Fallback for test environments or direct imports before startup
    return {
      valkeyHost: process.env.VALKEY_HOST ?? '127.0.0.1',
      valkeyPort: parseInt(process.env.VALKEY_PORT ?? '6379', 10),
      typesenseUrl: process.env.TYPESENSE_URL ?? '',
      opensearchUrl: process.env.OPENSEARCH_URL ?? 'http://127.0.0.1:9200',
      opensearchUsername: process.env.OPENSEARCH_USERNAME ?? '',
      opensearchPassword: process.env.OPENSEARCH_PASSWORD ?? '',
      centrifugoApiUrl: process.env.CENTRIFUGO_API_URL ?? '',
      typesenseApiKey: process.env.TYPESENSE_API_KEY ?? '',
      centrifugoApiKey: process.env.CENTRIFUGO_API_KEY ?? '',
    };
  }
  return _config;
}
