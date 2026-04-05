/**
 * Checkout Flow — 20 VU, 3 min.
 * Tests cart → checkout page load (does not complete real transactions).
 * k6 runtime: ES modules, no Node.js APIs.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, defaultThresholds } from "../helpers/config.js";
import { login, authHeaders } from "../helpers/auth.js";

export const options = {
  vus: 20,
  duration: "3m",
  thresholds: defaultThresholds,
};

export function setup() {
  const email = __ENV.TEST_BUYER_EMAIL || "buyer@test.twicely.co";
  const password = __ENV.TEST_BUYER_PASSWORD || "test-password";
  return { sessionCookie: login(email, password) };
}

export default function (data) {
  const headers = authHeaders(data.sessionCookie);

  // Step 1: View cart
  const cartResponse = http.get(`${BASE_URL}/cart`, {
    headers: { ...headers, Accept: "text/html" },
  });
  check(cartResponse, {
    "cart page loads": (r) => r.status === 200 || r.status === 302,
    "cart response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Step 2: View checkout page (no actual payment submission)
  const checkoutResponse = http.get(`${BASE_URL}/checkout`, {
    headers: { ...headers, Accept: "text/html" },
  });
  check(checkoutResponse, {
    "checkout page loads": (r) => r.status === 200 || r.status === 302,
    "checkout response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 3 + 2);
}
