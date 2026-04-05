/**
 * Listing Detail — 100 VU sustained, 3 min.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, defaultThresholds } from "../helpers/config.js";

export const options = {
  vus: 100,
  duration: "3m",
  thresholds: defaultThresholds,
};

/**
 * Listing slugs to cycle through during load test.
 * In a real environment these would be populated from a data file or env var.
 */
const LISTING_SLUGS = __ENV.LISTING_SLUGS
  ? __ENV.LISTING_SLUGS.split(",")
  : [
      "nike-air-jordan-1-retro-abc123",
      "vintage-levi-denim-jacket-def456",
      "supreme-box-logo-hoodie-ghi789",
      "gucci-marmont-bag-jkl012",
      "lululemon-align-leggings-mno345",
    ];

export default function () {
  const slugIndex = Math.floor(Math.random() * LISTING_SLUGS.length);
  const slug = LISTING_SLUGS[slugIndex];
  const url = `${BASE_URL}/i/${slug}`;

  const response = http.get(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
  });

  check(response, {
    "status is 200 or 404": (r) => r.status === 200 || r.status === 404,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 3 + 1);
}
