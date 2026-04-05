/**
 * Search Load — 200-1000 VU ramp, 5 min.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, defaultThresholds } from "../helpers/config.js";

export const options = {
  stages: [
    { duration: "1m", target: 200 },
    { duration: "3m", target: 1000 },
    { duration: "1m", target: 0 },
  ],
  thresholds: defaultThresholds,
};

const SEARCH_QUERIES = [
  "nike",
  "vintage jacket",
  "levi jeans",
  "air jordan",
  "gucci bag",
  "supreme hoodie",
  "lululemon",
  "patagonia",
  "coach purse",
  "adidas",
];

export default function () {
  const queryIndex = Math.floor(Math.random() * SEARCH_QUERIES.length);
  const query = SEARCH_QUERIES[queryIndex];
  const url = `${BASE_URL}/s?q=${encodeURIComponent(query)}`;

  const response = http.get(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
  });

  check(response, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 1.5 + 0.5);
}
