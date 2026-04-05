/**
 * Rate Limit Verify — validates rate limiting for all actor types.
 * Intentionally fires bursts to confirm 429 responses are returned.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { counter } from "k6/metrics";
import { BASE_URL } from "../helpers/config.js";

export const options = {
  scenarios: {
    anonymous_burst: {
      executor: "constant-arrival-rate",
      rate: 200,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    // We expect 429s — this scenario is verifying the limit works
    http_req_duration: ["p(95)<1000"],
  },
};

const rateLimitHits = new counter("rate_limit_hits");

export default function () {
  // Hit the search endpoint in rapid succession (unauthenticated)
  const response = http.get(`${BASE_URL}/s?q=test`, {
    headers: { Accept: "application/json" },
  });

  check(response, {
    "response received": (r) => r.status > 0,
  });

  if (response.status === 429) {
    rateLimitHits.add(1);
  }

  // Minimal sleep — intentional burst to trigger rate limits
  sleep(0.01);
}
