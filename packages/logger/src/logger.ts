/**
 * Structured Logger
 *
 * Replaces console.log/error/warn in production code.
 * Outputs JSON-formatted logs compatible with Loki ingestion.
 * Tech stack: Grafana + Prometheus + Loki (see CLAUDE.md).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

function formatLog(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context && { context }),
  };
}

function emit(entry: LogEntry): void {
  const output = JSON.stringify(entry);
  if (entry.level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

interface RequestLoggerContext {
  requestId?: string;
  userId?: string;
  route?: string;
}

/**
 * Create a request-scoped logger that includes context fields in every log entry.
 */
export function createRequestLogger(ctx: RequestLoggerContext) {
  return {
    debug(message: string, extra?: Record<string, unknown>): void {
      if (process.env.NODE_ENV === 'development') {
        emit(formatLog('debug', message, { ...ctx, ...extra }));
      }
    },
    info(message: string, extra?: Record<string, unknown>): void {
      emit(formatLog('info', message, { ...ctx, ...extra }));
    },
    warn(message: string, extra?: Record<string, unknown>): void {
      emit(formatLog('warn', message, { ...ctx, ...extra }));
    },
    error(message: string, extra?: Record<string, unknown>): void {
      emit(formatLog('error', message, { ...ctx, ...extra }));
    },
  };
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      emit(formatLog('debug', message, context));
    }
  },

  info(message: string, context?: Record<string, unknown>): void {
    emit(formatLog('info', message, context));
  },

  warn(message: string, context?: Record<string, unknown>): void {
    emit(formatLog('warn', message, context));
  },

  error(message: string, context?: Record<string, unknown>): void {
    emit(formatLog('error', message, context));
  },
};
