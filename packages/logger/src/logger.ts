/**
 * Structured Logger — pino with optional Loki transport
 *
 * - development: pretty-print to console (via pino-pretty)
 * - production: JSON to stdout + Loki push if LOKI_URL is set
 * - All entries include: timestamp, level, service, environment
 *
 * Tech stack: Grafana + Prometheus + Loki (see CLAUDE.md)
 */

import pino from 'pino';
import type { TransportTargetOptions } from 'pino';

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const lokiUrl = process.env.LOKI_URL;
const lokiAuth = process.env.LOKI_BASIC_AUTH;
const serviceName = process.env.SERVICE_NAME ?? 'twicely-web';

function buildTransports(): pino.TransportMultiOptions | pino.TransportSingleOptions | undefined {
  // Tests: no transports (silent or minimal)
  if (isTest) return undefined;

  const targets: TransportTargetOptions[] = [];

  if (isDev) {
    // Pretty-print in development
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      level: 'debug',
    });
  } else {
    // JSON to stdout in production
    targets.push({
      target: 'pino/file',
      options: { destination: 1 }, // stdout
      level: 'info',
    });

    // Loki transport in production when LOKI_URL is set
    if (lokiUrl) {
      targets.push({
        target: 'pino-loki',
        options: {
          host: lokiUrl,
          ...(lokiAuth ? { basicAuth: { username: lokiAuth.split(':')[0], password: lokiAuth.split(':')[1] } } : {}),
          batching: true,
          interval: 5,
          labels: { app: 'twicely', service: serviceName, env: process.env.NODE_ENV ?? 'production' },
        },
        level: 'info',
      });
    }
  }

  if (targets.length === 0) return undefined;
  if (targets.length === 1) return { target: targets[0]!.target, options: targets[0]!.options };
  return { targets };
}

const transport = buildTransports();

const pinoLogger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isTest ? { level: 'silent' } : {}),
  ...(transport ? { transport } : {}),
  base: { service: serviceName },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ── Public API (same signature as before) ────────────────────────────────

interface RequestLoggerContext {
  requestId?: string;
  userId?: string;
  route?: string;
}

/**
 * Create a request-scoped logger that includes context fields in every log entry.
 */
export function createRequestLogger(ctx: RequestLoggerContext) {
  const child = pinoLogger.child(ctx);
  return {
    debug(message: string, extra?: Record<string, unknown>): void {
      child.debug(extra ?? {}, message);
    },
    info(message: string, extra?: Record<string, unknown>): void {
      child.info(extra ?? {}, message);
    },
    warn(message: string, extra?: Record<string, unknown>): void {
      child.warn(extra ?? {}, message);
    },
    error(message: string, extra?: Record<string, unknown>): void {
      child.error(extra ?? {}, message);
    },
  };
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    pinoLogger.debug(context ?? {}, message);
  },

  info(message: string, context?: Record<string, unknown>): void {
    pinoLogger.info(context ?? {}, message);
  },

  warn(message: string, context?: Record<string, unknown>): void {
    pinoLogger.warn(context ?? {}, message);
  },

  error(message: string, context?: Record<string, unknown>): void {
    pinoLogger.error(context ?? {}, message);
  },
};
