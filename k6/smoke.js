/**
 * Smoke Test — 1 VU, 30s.
 * Quick sanity check: core endpoints respond before full load suite.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import { check, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // GET /
  const homepage = http.get(`${BASE_URL}/`, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
  });

  check(homepage, {
    'smoke: / status is 200': (r) => r.status === 200,
    'smoke: / response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // GET /api/health
  const health = http.get(`${BASE_URL}/api/health`, {
    headers: { Accept: 'application/json' },
  });

  check(health, {
    'smoke: /api/health status is 200': (r) => r.status === 200,
    'smoke: /api/health response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
