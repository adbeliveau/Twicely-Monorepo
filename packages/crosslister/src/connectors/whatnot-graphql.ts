/**
 * Low-level GraphQL helper for Whatnot Seller API.
 * Handles: environment-aware URL resolution, auth header injection,
 * error extraction, and response typing.
 * NOT a 'use server' file.
 * Source: H2.2 install prompt §2.2
 */

import { logger } from '@twicely/logger';

export interface WhatnotGraphQLRequestOptions {
  accessToken: string;
  environment: string; // 'PRODUCTION' | 'STAGING'
  query: string;
  variables?: Record<string, unknown>;
}

export interface WhatnotGraphQLResult<T> {
  data: T | null;
  errors: Array<{ message: string; path?: string[] }> | null;
  status: number;
}

/**
 * Returns the Whatnot Seller GraphQL API URL based on environment.
 */
export function getGraphQLUrl(environment: string): string {
  return environment === 'STAGING'
    ? 'https://api.stage.whatnot.com/seller-api/graphql'
    : 'https://api.whatnot.com/seller-api/graphql';
}

/**
 * Execute a single GraphQL request against the Whatnot Seller API.
 * Does NOT throw — caller decides how to handle errors.
 * On HTTP errors, still attempts to parse body for GraphQL error messages.
 */
export async function executeGraphQL<T>(
  options: WhatnotGraphQLRequestOptions,
): Promise<WhatnotGraphQLResult<T>> {
  const url = getGraphQLUrl(options.environment);
  const body = JSON.stringify({
    query: options.query,
    variables: options.variables,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.accessToken}`,
      },
      body,
    });
  } catch (err) {
    logger.error('[WhatnotGraphQL] Network error', { error: String(err) });
    return { data: null, errors: [{ message: String(err) }], status: 0 };
  }

  let parsed: { data?: T | null; errors?: Array<{ message: string; path?: string[] }> };
  try {
    parsed = await response.json() as typeof parsed;
  } catch {
    // Body not parseable as JSON
    if (!response.ok) {
      logger.error('[WhatnotGraphQL] HTTP error with unparseable body', { status: response.status });
      return {
        data: null,
        errors: [{ message: `HTTP ${response.status}` }],
        status: response.status,
      };
    }
    return { data: null, errors: null, status: response.status };
  }

  if (!response.ok) {
    const errors = parsed.errors ?? [{ message: `HTTP ${response.status}` }];
    logger.error('[WhatnotGraphQL] HTTP error', { status: response.status, errors });
    return { data: null, errors, status: response.status };
  }

  if (parsed.errors?.length) {
    logger.error('[WhatnotGraphQL] GraphQL errors', { errors: parsed.errors });
    return { data: parsed.data ?? null, errors: parsed.errors, status: response.status };
  }

  return { data: parsed.data ?? null, errors: null, status: response.status };
}
