/**
 * Provider Resolution + Fallback Chain
 *
 * Resolves the active AI provider from platform_settings.
 * Implements fallback chain: primary -> fallback on retryable errors.
 * Circuit breaker integration prevents cascading failures.
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiProvider } from '../types';
import { CircuitBreaker } from '../circuit-breaker';

const RETRYABLE_STATUS_CODES = [429, 500, 502, 503];
const MAX_RETRIES = 2;

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(providerName: string): CircuitBreaker {
  let cb = circuitBreakers.get(providerName);
  if (!cb) {
    cb = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
    });
    circuitBreakers.set(providerName, cb);
  }
  return cb;
}

async function instantiateProvider(name: string): Promise<AiProvider> {
  switch (name) {
    case 'openai': {
      const { OpenAiProvider } = await import('./openai');
      return new OpenAiProvider();
    }
    case 'anthropic': {
      const { AnthropicProvider } = await import('./anthropic');
      return new AnthropicProvider();
    }
    default:
      throw new Error(`Unknown AI provider: ${name}`);
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    for (const code of RETRYABLE_STATUS_CODES) {
      if (err.message.includes(String(code))) return true;
    }
  }
  return false;
}

/**
 * Resolve the active primary provider from platform_settings.
 * Returns the provider instance ready for use.
 */
export async function resolveProvider(): Promise<AiProvider> {
  const name = await getPlatformSetting<string>('ai.provider', 'openai');
  return instantiateProvider(name);
}

/**
 * Execute an AI operation with fallback chain.
 * Tries primary provider first, falls through to fallback on retryable errors.
 * Circuit breaker protects each provider independently.
 */
export async function executeWithFallback<T>(
  operation: (provider: AiProvider) => Promise<T>,
): Promise<T> {
  const primaryName = await getPlatformSetting<string>('ai.provider', 'openai');
  const fallbackName = await getPlatformSetting<string>('ai.provider.fallback', 'anthropic');

  const providers = [primaryName, fallbackName];
  let lastError: Error | null = null;

  for (const providerName of providers) {
    const cb = getCircuitBreaker(providerName);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await cb.execute(async () => {
          const provider = await instantiateProvider(providerName);
          return operation(provider);
        });
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        logger.warn(`[provider-resolver] ${providerName} attempt ${attempt + 1} failed`, {
          provider: providerName,
          attempt: attempt + 1,
          error: lastError.message,
        });

        // Only retry on retryable errors
        if (!isRetryableError(err)) break;
      }
    }
  }

  throw lastError ?? new Error('All AI providers failed');
}

/**
 * Reset all circuit breakers (for testing).
 */
export function resetAllCircuitBreakers(): void {
  for (const cb of circuitBreakers.values()) {
    cb.reset();
  }
  circuitBreakers.clear();
}
