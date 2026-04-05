/**
 * Auth Flow — 50 VU, 3 min.
 * Tests login, session check, and logout.
 * k6 runtime: ES modules, no Node.js APIs.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, defaultThresholds } from "../helpers/config.js";

export const options = {
  vus: 50,
  duration: "3m",
  thresholds: defaultThresholds,
};

export default function () {
  const email = __ENV.TEST_BUYER_EMAIL || "buyer@test.twicely.co";
  const password = __ENV.TEST_BUYER_PASSWORD || "test-password";

  // Step 1: Request login page
  const loginPage = http.get(`${BASE_URL}/auth/login`, {
    headers: { Accept: "text/html" },
  });
  check(loginPage, {
    "login page status is 200": (r) => r.status === 200,
  });

  sleep(0.5);

  // Step 2: Submit login credentials
  const loginPayload = JSON.stringify({ email, password });
  const loginResponse = http.post(
    `${BASE_URL}/api/auth/sign-in/email`,
    loginPayload,
    { headers: { "Content-Type": "application/json" } }
  );

  const loginOk = check(loginResponse, {
    "login response is 200": (r) => r.status === 200,
  });

  if (!loginOk) {
    sleep(1);
    return;
  }

  const cookies = loginResponse.cookies;
  const sessionToken = cookies["better-auth.session_token"];
  if (!sessionToken || sessionToken.length === 0) {
    sleep(1);
    return;
  }

  const cookieHeader = `better-auth.session_token=${sessionToken[0].value}`;

  sleep(0.5);

  // Step 3: Access protected route
  const hubResponse = http.get(`${BASE_URL}/my`, {
    headers: { Cookie: cookieHeader },
  });
  check(hubResponse, {
    "hub page accessible after login": (r) => r.status === 200 || r.status === 302,
  });

  sleep(1);

  // Step 4: Sign out
  const signOutResponse = http.post(
    `${BASE_URL}/api/auth/sign-out`,
    null,
    { headers: { Cookie: cookieHeader } }
  );
  check(signOutResponse, {
    "sign out status is 200": (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 1);
}
