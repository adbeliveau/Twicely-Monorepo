/**
 * API Load Test — 20 VUs, 3min duration.
 * Exercises POST /api/search, GET /api/cart, GET /api/listings.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import { check, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 20,
  duration: '3m',
  thresholds: {
    'http_req_duration{name:search-api}': ['p(95)<300'],
    'http_req_duration{name:cart-api}': ['p(95)<300'],
    'http_req_duration{name:listings-api}': ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // POST /api/search
  const searchPayload = JSON.stringify({ q: 'sneakers', page: 1, pageSize: 24 });
  const searchResponse = http.post(
    `${BASE_URL}/api/search`,
    searchPayload,
    {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      tags: { name: 'search-api' },
    },
  );

  check(searchResponse, {
    'api: POST /api/search status 2xx': (r) => r.status >= 200 && r.status < 300,
    'api: POST /api/search response time < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(0.5);

  // GET /api/cart
  const cartResponse = http.get(`${BASE_URL}/api/cart`, {
    headers: { Accept: 'application/json' },
    tags: { name: 'cart-api' },
  });

  check(cartResponse, {
    'api: GET /api/cart status not 5xx': (r) => r.status < 500,
    'api: GET /api/cart response time < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(0.5);

  // GET /api/listings
  const listingsResponse = http.get(`${BASE_URL}/api/listings?page=1`, {
    headers: { Accept: 'application/json' },
    tags: { name: 'listings-api' },
  });

  check(listingsResponse, {
    'api: GET /api/listings status 2xx': (r) => r.status >= 200 && r.status < 300,
    'api: GET /api/listings response time < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(1);
}
