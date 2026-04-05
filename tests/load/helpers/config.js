/**
 * Shared k6 configuration — thresholds and base URL.
 * k6 runtime: uses ES modules, no Node.js APIs.
 */

export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const defaultThresholds = {
  http_req_duration: ["p(95)<500", "p(99)<1000"],
  http_req_failed: ["rate<0.01"],
  http_reqs: ["rate>100"],
};

export const scenarios = {
  homepage_browse: {
    executor: "ramping-vus",
    startVUs: 100,
    stages: [
      { duration: "1m", target: 200 },
      { duration: "3m", target: 500 },
      { duration: "1m", target: 0 },
    ],
    gracefulRampDown: "30s",
  },
  search_load: {
    executor: "ramping-vus",
    startVUs: 200,
    stages: [
      { duration: "1m", target: 500 },
      { duration: "3m", target: 1000 },
      { duration: "1m", target: 0 },
    ],
    gracefulRampDown: "30s",
  },
  listing_detail: {
    executor: "constant-vus",
    vus: 100,
    duration: "3m",
  },
  auth_flow: {
    executor: "constant-vus",
    vus: 50,
    duration: "3m",
  },
  checkout_flow: {
    executor: "constant-vus",
    vus: 20,
    duration: "3m",
  },
  api_stress: {
    executor: "ramping-vus",
    startVUs: 300,
    stages: [
      { duration: "1m", target: 600 },
      { duration: "3m", target: 1000 },
      { duration: "1m", target: 0 },
    ],
    gracefulRampDown: "30s",
  },
  websocket_connect: {
    executor: "constant-vus",
    vus: 50,
    duration: "3m",
  },
  image_upload: {
    executor: "constant-vus",
    vus: 10,
    duration: "2m",
  },
};

export const smokeThresholds = {
  http_req_duration: ["p(95)<2000"],
  http_req_failed: ["rate<0.05"],
};
