/**
 * Load Test — ramp 0→50 VUs (2min), hold 50 VUs (5min), ramp down (1min).
 * Exercises homepage, search, category pages, and listing detail.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import { check, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

const ENDPOINTS = [
  { path: '/', name: 'homepage' },
  { path: '/s?q=sneakers', name: 'search' },
  { path: '/c/clothing', name: 'category' },
  { path: '/i/test-listing-slug', name: 'listing-detail' },
];

export default function () {
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const url = `${BASE_URL}${endpoint.path}`;

  const response = http.get(url, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    tags: { name: endpoint.name },
  });

  check(response, {
    [`load: ${endpoint.name} status 2xx or 3xx`]: (r) =>
      r.status >= 200 && r.status < 400,
    [`load: ${endpoint.name} response time < 500ms`]: (r) =>
      r.timings.duration < 500,
  });

  sleep(1);
}
