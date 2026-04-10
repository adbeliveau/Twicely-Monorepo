/**
 * Circuit Breaker — Per-Provider
 *
 * States:
 *   CLOSED  — normal operation, calls pass through
 *   OPEN    — after failureThreshold consecutive failures, all calls rejected
 *   HALF_OPEN — after resetTimeoutMs cooldown, allows 1 probe request
 *     - If probe succeeds: transition to CLOSED
 *     - If probe fails: transition back to OPEN
 *
 * Each AI provider (openai, anthropic) has its own circuit breaker.
 */

import { AiUnavailableError } from './types';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

export class CircuitBreaker {
  private _state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(opts: CircuitBreakerOptions) {
    this.failureThreshold = opts.failureThreshold;
    this.resetTimeoutMs = opts.resetTimeoutMs;
  }

  get state(): CircuitState {
    if (this._state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this._state = 'HALF_OPEN';
      }
    }
    return this._state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.state;

    if (currentState === 'OPEN') {
      throw new AiUnavailableError(
        `Circuit breaker is OPEN. Will retry after ${this.resetTimeoutMs}ms cooldown.`,
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this._state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this._state === 'HALF_OPEN') {
      // Probe failed — go back to OPEN
      this._state = 'OPEN';
    } else if (this.failureCount >= this.failureThreshold) {
      this._state = 'OPEN';
    }
  }

  reset(): void {
    this._state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

export { AiUnavailableError };
