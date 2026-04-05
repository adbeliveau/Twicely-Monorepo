/**
 * WebSocket Connect — 50 VU, 3 min.
 * Validates Centrifugo realtime endpoint availability.
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

/**
 * Centrifugo connection token endpoint.
 * Tests the subscribe token API which is required before WS upgrade.
 */
export default function () {
  const subscribeUrl = `${BASE_URL}/api/realtime/subscribe`;

  const response = http.post(
    subscribeUrl,
    JSON.stringify({ channel: "public:listings" }),
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  check(response, {
    "subscribe endpoint responds": (r) =>
      r.status === 200 || r.status === 401 || r.status === 403,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 2 + 1);
}
