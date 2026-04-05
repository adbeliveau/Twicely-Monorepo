/**
 * API Stress — 300-1000 VU ramp, 5 min.
 * Hits public API endpoints to stress the backend.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, defaultThresholds } from "../helpers/config.js";

export const options = {
  stages: [
    { duration: "1m", target: 300 },
    { duration: "3m", target: 1000 },
    { duration: "1m", target: 0 },
  ],
  thresholds: defaultThresholds,
};

const API_ENDPOINTS = [
  "/api/health",
  "/s?q=nike&format=json",
  "/api/listings/featured",
  "/api/categories",
];

export default function () {
  const endpointIndex = Math.floor(Math.random() * API_ENDPOINTS.length);
  const endpoint = API_ENDPOINTS[endpointIndex];
  const url = `${BASE_URL}${endpoint}`;

  const response = http.get(url, {
    headers: { Accept: "application/json" },
  });

  check(response, {
    "status is 2xx or 3xx": (r) => r.status >= 200 && r.status < 400,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 0.5 + 0.1);
}
