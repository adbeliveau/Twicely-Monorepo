/**
 * Generate Security Report — aggregates header check findings into a report.
 * Usage: tsx scripts/generate-security-report.ts --url http://localhost:3000
 */

import { buildReport, type CheckReport, type CheckStatus } from "./security-header-check";

interface AggregatedReport {
  generatedAt: string;
  targets: CheckReport[];
  summary: {
    total: number;
    passed: number;
    warned: number;
    failed: number;
    overallStatus: CheckStatus;
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

function computeOverall(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("WARN")) return "WARN";
  return "PASS";
}

async function runChecks(urls: string[]): Promise<CheckReport[]> {
  const reports: CheckReport[] = [];
  for (const url of urls) {
    try {
      const headers = await fetchHeaders(url);
      const report = buildReport(url, headers);
      reports.push(report);
    } catch (err) {
      const errorReport: CheckReport = {
        url,
        timestamp: new Date().toISOString(),
        results: [],
        overall: "FAIL",
      };
      console.error(`Error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`);
      reports.push(errorReport);
    }
  }
  return reports;
}

function aggregateReports(reports: CheckReport[]): AggregatedReport {
  const passed = reports.filter((r) => r.overall === "PASS").length;
  const warned = reports.filter((r) => r.overall === "WARN").length;
  const failed = reports.filter((r) => r.overall === "FAIL").length;

  return {
    generatedAt: new Date().toISOString(),
    targets: reports,
    summary: {
      total: reports.length,
      passed,
      warned,
      failed,
      overallStatus: computeOverall(reports.map((r) => r.overall)),
    },
  };
}

function printAggregatedReport(report: AggregatedReport): void {
  console.log("\n=== Security Header Report ===");
  console.log(`Generated: ${report.generatedAt}`);
  console.log(
    `Targets: ${report.summary.total} | PASS: ${report.summary.passed} | WARN: ${report.summary.warned} | FAIL: ${report.summary.failed}`
  );
  console.log(`Overall: ${report.summary.overallStatus}\n`);

  for (const target of report.targets) {
    console.log(`--- ${target.url} (${target.overall}) ---`);
    for (const result of target.results) {
      const icon = result.status === "PASS" ? "[PASS]" : result.status === "WARN" ? "[WARN]" : "[FAIL]";
      console.log(`  ${icon} ${result.header}: ${result.message}`);
    }
  }
  console.log("\n==============================\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const urls: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--url" && args[i + 1]) {
      urls.push(args[i + 1] as string);
      i += 2;
    } else {
      i++;
    }
  }

  if (urls.length === 0) {
    urls.push("http://localhost:3000");
  }

  const reports = await runChecks(urls);
  const aggregated = aggregateReports(reports);
  printAggregatedReport(aggregated);

  if (aggregated.summary.overallStatus === "FAIL") {
    process.exit(1);
  }
  process.exit(0);
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
