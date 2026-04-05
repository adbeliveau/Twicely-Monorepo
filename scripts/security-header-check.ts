/**
 * Security Header Check — validates HTTP response headers against spec.
 * Usage: tsx scripts/security-header-check.ts --url http://localhost:3000
 */

export type CheckStatus = "PASS" | "WARN" | "FAIL";

export interface HeaderResult {
  header: string;
  status: CheckStatus;
  value: string | null;
  message: string;
}

export interface CheckReport {
  url: string;
  timestamp: string;
  results: HeaderResult[];
  overall: CheckStatus;
}

function resolveStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("WARN")) return "WARN";
  return "PASS";
}

export function validateSts(value: string | null): HeaderResult {
  const header = "Strict-Transport-Security";
  if (!value) {
    return { header, status: "FAIL", value: null, message: "Header missing" };
  }
  const hasMaxAge = /max-age=\d+/i.test(value);
  if (!hasMaxAge) {
    return { header, status: "FAIL", value, message: "max-age directive missing" };
  }
  const match = value.match(/max-age=(\d+)/i);
  const maxAge = match ? parseInt(match[1] ?? "0", 10) : 0;
  if (maxAge < 31536000) {
    return { header, status: "WARN", value, message: "max-age < 31536000 (recommend 1 year)" };
  }
  return { header, status: "PASS", value, message: "OK" };
}

export function validateCsp(value: string | null): HeaderResult {
  const header = "Content-Security-Policy";
  if (!value) {
    return { header, status: "FAIL", value: null, message: "Header missing" };
  }
  const hasDefaultSrc = /default-src/i.test(value);
  if (!hasDefaultSrc) {
    return { header, status: "WARN", value, message: "default-src directive missing" };
  }
  return { header, status: "PASS", value, message: "OK" };
}

export function validateXContentTypeOptions(value: string | null): HeaderResult {
  const header = "X-Content-Type-Options";
  if (!value) {
    return { header, status: "FAIL", value: null, message: "Header missing" };
  }
  if (value.toLowerCase() !== "nosniff") {
    return { header, status: "FAIL", value, message: "Expected 'nosniff'" };
  }
  return { header, status: "PASS", value, message: "OK" };
}

export function validateXFrameOptions(value: string | null): HeaderResult {
  const header = "X-Frame-Options";
  if (!value) {
    return { header, status: "FAIL", value: null, message: "Header missing" };
  }
  const allowed = ["deny", "sameorigin"];
  if (!allowed.includes(value.toLowerCase())) {
    return { header, status: "WARN", value, message: "Expected DENY or SAMEORIGIN" };
  }
  return { header, status: "PASS", value, message: "OK" };
}

export function validateReferrerPolicy(value: string | null): HeaderResult {
  const header = "Referrer-Policy";
  if (!value) {
    return { header, status: "WARN", value: null, message: "Header missing (recommended)" };
  }
  const safe = [
    "no-referrer",
    "no-referrer-when-downgrade",
    "strict-origin",
    "strict-origin-when-cross-origin",
    "same-origin",
  ];
  if (!safe.includes(value.toLowerCase())) {
    return { header, status: "WARN", value, message: "Consider a stricter referrer policy" };
  }
  return { header, status: "PASS", value, message: "OK" };
}

export function validatePermissionsPolicy(value: string | null): HeaderResult {
  const header = "Permissions-Policy";
  if (!value) {
    return { header, status: "WARN", value: null, message: "Header missing (recommended)" };
  }
  return { header, status: "PASS", value, message: "OK" };
}

export function buildReport(
  url: string,
  headers: Record<string, string | null>
): CheckReport {
  const results: HeaderResult[] = [
    validateSts(headers["strict-transport-security"] ?? null),
    validateCsp(headers["content-security-policy"] ?? null),
    validateXContentTypeOptions(headers["x-content-type-options"] ?? null),
    validateXFrameOptions(headers["x-frame-options"] ?? null),
    validateReferrerPolicy(headers["referrer-policy"] ?? null),
    validatePermissionsPolicy(headers["permissions-policy"] ?? null),
  ];

  const overall = resolveStatus(results.map((r) => r.status));

  return {
    url,
    timestamp: new Date().toISOString(),
    results,
    overall,
  };
}

async function fetchHeaders(url: string): Promise<Record<string, string | null>> {
  const response = await fetch(url, { method: "GET" });
  const headerNames = [
    "strict-transport-security",
    "content-security-policy",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
  ];
  const result: Record<string, string | null> = {};
  for (const name of headerNames) {
    result[name] = response.headers.get(name);
  }
  return result;
}

function printReport(report: CheckReport): void {
  console.log(`\nSecurity Header Check — ${report.url}`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Overall: ${report.overall}\n`);

  const statusIcon: Record<CheckStatus, string> = {
    PASS: "[PASS]",
    WARN: "[WARN]",
    FAIL: "[FAIL]",
  };

  for (const result of report.results) {
    const icon = statusIcon[result.status];
    console.log(`${icon} ${result.header}`);
    console.log(`       ${result.message}`);
    if (result.value) {
      const truncated =
        result.value.length > 80
          ? result.value.substring(0, 80) + "..."
          : result.value;
      console.log(`       Value: ${truncated}`);
    }
  }
  console.log("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let url = "http://localhost:3000";

  const urlIndex = args.indexOf("--url");
  if (urlIndex !== -1 && args[urlIndex + 1]) {
    url = args[urlIndex + 1] as string;
  }

  let headers: Record<string, string | null>;
  try {
    headers = await fetchHeaders(url);
  } catch (err) {
    console.error(`Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const report = buildReport(url, headers);
  printReport(report);

  if (report.overall === "FAIL") {
    process.exit(1);
  }
  process.exit(0);
}

// Only run when executed directly, not when imported by tests
if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
