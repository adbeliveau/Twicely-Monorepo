/**
 * Prometheus metrics registry.
 * Defines all application metrics with `twicely_` prefix.
 * E5 — Monitoring
 *
 * Uses a custom Registry (not the default global) to avoid collisions.
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const metricsRegistry = new Registry();

// ── HTTP Metrics ─────────────────────────────────────────────────────────────

const httpRequestsTotal = new Counter({
  name: 'twicely_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['route', 'method', 'status'] as const,
  registers: [metricsRegistry],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'twicely_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['route', 'method'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// ── Order Metrics ─────────────────────────────────────────────────────────────

const ordersTotal = new Counter({
  name: 'twicely_orders_total',
  help: 'Total orders by status',
  labelNames: ['status'] as const,
  registers: [metricsRegistry],
});

// ── Payment Metrics ───────────────────────────────────────────────────────────

const paymentsTotal = new Counter({
  name: 'twicely_payments_total',
  help: 'Payment attempts by outcome',
  labelNames: ['outcome'] as const,
  registers: [metricsRegistry],
});

// ── Listing Metrics ───────────────────────────────────────────────────────────

const listingsActive = new Gauge({
  name: 'twicely_listings_active',
  help: 'Current active listing count',
  registers: [metricsRegistry],
});

// ── User Metrics ──────────────────────────────────────────────────────────────

const usersActiveDailiy = new Gauge({
  name: 'twicely_users_active_daily',
  help: 'Daily active user count (approximate)',
  registers: [metricsRegistry],
});

// ── Search Metrics ────────────────────────────────────────────────────────────

const searchQueriesTotal = new Counter({
  name: 'twicely_search_queries_total',
  help: 'Total search queries by type',
  labelNames: ['type'] as const,
  registers: [metricsRegistry],
});

const searchLatencySeconds = new Histogram({
  name: 'twicely_search_latency_seconds',
  help: 'Search response time in seconds',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

// ── Utility Functions ─────────────────────────────────────────────────────────

export function incrementHttpRequest(route: string, method: string, status: number): void {
  httpRequestsTotal.inc({ route, method, status: String(status) });
}

export function observeHttpDuration(route: string, method: string, durationSeconds: number): void {
  httpRequestDurationSeconds.observe({ route, method }, durationSeconds);
}

export function incrementOrder(status: string): void {
  ordersTotal.inc({ status });
}

export function incrementPayment(outcome: string): void {
  paymentsTotal.inc({ outcome });
}

export function setActiveListings(count: number): void {
  listingsActive.set(count);
}

export function setDailyActiveUsers(count: number): void {
  usersActiveDailiy.set(count);
}

export function incrementSearchQuery(type: string): void {
  searchQueriesTotal.inc({ type });
}

export function observeSearchLatency(durationSeconds: number): void {
  searchLatencySeconds.observe(durationSeconds);
}

export async function getMetricsText(): Promise<string> {
  return metricsRegistry.metrics();
}
