/**
 * Smoke Test — quick sanity check: 5 VU, 30s.
 * Verifies core pages respond before running full load suite.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, smokeThresholds } from "./helpers/config.js";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: smokeThresholds,
};

const SMOKE_PATHS = [
  "/",
  "/s?q=test",
  "/c/clothing",
  "/auth/login",
  "/pricing",
];

export default function () {
  const pathIndex = Math.floor(Math.random() * SMOKE_PATHS.length);
  const path = SMOKE_PATHS[pathIndex];
  const url = `${BASE_URL}${path}`;

  const response = http.get(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
  });

  check(response, {
    "smoke: status is 200": (r) => r.status === 200,
    "smoke: response time < 2000ms": (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
