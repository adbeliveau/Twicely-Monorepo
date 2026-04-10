/**
 * Stress Test — ramp to 100→200→300 VUs to find breaking point.
 * Same endpoints as load test; thresholds are intentionally relaxed
 * so the test completes even when the system is stressed.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import { check, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '3m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '3m', target: 300 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'],
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
    [`stress: ${endpoint.name} status not 5xx`]: (r) => r.status < 500,
  });

  sleep(0.5);
}
