/**
 * Auth helper for k6 load tests.
 * Performs login and returns session cookie for authenticated scenarios.
 * k6 runtime: uses ES modules, no Node.js APIs.
 */

import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "./config.js";

/**
 * Login and return session cookie string.
 * Returns null if login fails.
 * @param {string} email
 * @param {string} password
 * @returns {string|null}
 */
export function login(email, password) {
  const payload = JSON.stringify({ email, password });
  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const response = http.post(`${BASE_URL}/api/auth/sign-in/email`, payload, params);

  const ok = check(response, {
    "login status is 200": (r) => r.status === 200,
  });

  if (!ok) {
    return null;
  }

  const cookies = response.cookies;
  const sessionCookie = cookies["better-auth.session_token"];
  if (!sessionCookie || sessionCookie.length === 0) {
    return null;
  }

  return `better-auth.session_token=${sessionCookie[0].value}`;
}

/**
 * Returns headers with session cookie for authenticated requests.
 * @param {string|null} sessionCookie
 * @returns {Object}
 */
export function authHeaders(sessionCookie) {
  if (!sessionCookie) {
    return { "Content-Type": "application/json" };
  }
  return {
    "Content-Type": "application/json",
    Cookie: sessionCookie,
  };
}

/** Test credentials sourced from environment variables. */
export const testCredentials = {
  buyer: {
    email: __ENV.TEST_BUYER_EMAIL || "buyer@test.twicely.co",
    password: __ENV.TEST_BUYER_PASSWORD || "test-password",
  },
  seller: {
    email: __ENV.TEST_SELLER_EMAIL || "seller@test.twicely.co",
    password: __ENV.TEST_SELLER_PASSWORD || "test-password",
  },
};
