/**
 * Full Load Test Suite — orchestrates all scenarios sequentially.
 * k6 runtime: ES modules, no Node.js APIs.
 *
 * Run with: k6 run tests/load/full-suite.js
 */

import { sleep } from "k6";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";
import { BASE_URL, defaultThresholds } from "./helpers/config.js";

export const options = {
  scenarios: {
    homepage_browse: {
      executor: "ramping-vus",
      startVUs: 100,
      stages: [
        { duration: "1m", target: 200 },
        { duration: "3m", target: 500 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
      exec: "homepageBrowse",
    },
    search_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 200 },
        { duration: "3m", target: 1000 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
      startTime: "5m30s",
      exec: "searchLoad",
    },
    listing_detail: {
      executor: "constant-vus",
      vus: 100,
      duration: "3m",
      startTime: "11m",
      exec: "listingDetail",
    },
    auth_flow: {
      executor: "constant-vus",
      vus: 50,
      duration: "3m",
      startTime: "14m30s",
      exec: "authFlow",
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
      startTime: "18m",
      exec: "apiStress",
    },
  },
  thresholds: defaultThresholds,
};

import http from "k6/http";
import { check } from "k6";

const BROWSE_PATHS = ["/", "/c/clothing", "/c/electronics", "/s?q=nike"];
const SEARCH_QUERIES = ["nike", "vintage jacket", "levi jeans", "air jordan"];
const LISTING_SLUGS = __ENV.LISTING_SLUGS
  ? __ENV.LISTING_SLUGS.split(",")
  : ["nike-air-jordan-1-retro-abc123", "vintage-levi-denim-jacket-def456"];
const API_ENDPOINTS = ["/api/health", "/api/categories"];

export function homepageBrowse() {
  const pathIndex = Math.floor(Math.random() * BROWSE_PATHS.length);
  const path = BROWSE_PATHS[pathIndex];
  const r = http.get(`${BASE_URL}${path}`, { headers: { Accept: "text/html" } });
  check(r, { "homepage 200": (res) => res.status === 200 });
  sleep(Math.random() * 2 + 1);
}

export function searchLoad() {
  const queryIndex = Math.floor(Math.random() * SEARCH_QUERIES.length);
  const query = SEARCH_QUERIES[queryIndex];
  const r = http.get(`${BASE_URL}/s?q=${encodeURIComponent(query)}`, {
    headers: { Accept: "text/html" },
  });
  check(r, { "search 200": (res) => res.status === 200 });
  sleep(Math.random() * 1.5 + 0.5);
}

export function listingDetail() {
  const slugIndex = Math.floor(Math.random() * LISTING_SLUGS.length);
  const slug = LISTING_SLUGS[slugIndex];
  const r = http.get(`${BASE_URL}/i/${slug}`, { headers: { Accept: "text/html" } });
  check(r, { "listing 200 or 404": (res) => res.status === 200 || res.status === 404 });
  sleep(Math.random() * 3 + 1);
}

export function authFlow() {
  const r = http.get(`${BASE_URL}/auth/login`, { headers: { Accept: "text/html" } });
  check(r, { "auth page 200": (res) => res.status === 200 });
  sleep(Math.random() * 2 + 1);
}

export function apiStress() {
  const endpointIndex = Math.floor(Math.random() * API_ENDPOINTS.length);
  const endpoint = API_ENDPOINTS[endpointIndex];
  const r = http.get(`${BASE_URL}${endpoint}`, { headers: { Accept: "application/json" } });
  check(r, { "api 2xx-3xx": (res) => res.status >= 200 && res.status < 400 });
  sleep(Math.random() * 0.5 + 0.1);
}

export function handleSummary(data) {
  return {
    "load-test-report.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
