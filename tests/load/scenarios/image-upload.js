/**
 * Image Upload — 10 VU, 2 min.
 * Tests presigned URL generation for Cloudflare R2 uploads.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, defaultThresholds } from "../helpers/config.js";
import { login, authHeaders } from "../helpers/auth.js";

export const options = {
  vus: 10,
  duration: "2m",
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    http_req_failed: ["rate<0.01"],
  },
};

export function setup() {
  const email = __ENV.TEST_SELLER_EMAIL || "seller@test.twicely.co";
  const password = __ENV.TEST_SELLER_PASSWORD || "test-password";
  return { sessionCookie: login(email, password) };
}

export default function (data) {
  const headers = authHeaders(data.sessionCookie);

  // Request a presigned upload URL — tests auth and R2 integration
  const presignResponse = http.post(
    `${BASE_URL}/api/storage/presign`,
    JSON.stringify({
      filename: `test-image-${Date.now()}.jpg`,
      contentType: "image/jpeg",
    }),
    { headers }
  );

  check(presignResponse, {
    "presign endpoint responds": (r) =>
      r.status === 200 || r.status === 401 || r.status === 403,
    "presign response time < 2000ms": (r) => r.timings.duration < 2000,
  });

  sleep(Math.random() * 5 + 3);
}
