/**
 * Homepage Browse — 100-500 VU ramp, 5 min.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, defaultThresholds } from "../helpers/config.js";

export const options = {
  stages: [
    { duration: "1m", target: 100 },
    { duration: "3m", target: 500 },
    { duration: "1m", target: 0 },
  ],
  thresholds: defaultThresholds,
};

const BROWSE_PATHS = [
  "/",
  "/c/clothing",
  "/c/electronics",
  "/c/shoes",
  "/c/accessories",
  "/s?q=nike",
  "/s?q=vintage+jacket",
];

export default function () {
  const pathIndex = Math.floor(Math.random() * BROWSE_PATHS.length);
  const path = BROWSE_PATHS[pathIndex];
  const url = `${BASE_URL}${path}`;

  const response = http.get(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
  });

  check(response, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 2 + 1);
}
