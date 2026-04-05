import { describe, it, expect } from "vitest";
import {
  validateSts,
  validateCsp,
  validateXContentTypeOptions,
  validateXFrameOptions,
  validateReferrerPolicy,
  validatePermissionsPolicy,
  buildReport,
} from "../security-header-check";

describe("validateSts", () => {
  it("FAIL when header missing", () => {
    const result = validateSts(null);
    expect(result.status).toBe("FAIL");
    expect(result.value).toBeNull();
  });

  it("FAIL when max-age directive missing", () => {
    const result = validateSts("includeSubDomains");
    expect(result.status).toBe("FAIL");
  });

  it("WARN when max-age < 31536000", () => {
    const result = validateSts("max-age=86400");
    expect(result.status).toBe("WARN");
  });

  it("PASS when max-age >= 31536000", () => {
    const result = validateSts("max-age=31536000; includeSubDomains");
    expect(result.status).toBe("PASS");
  });
});

describe("validateCsp", () => {
  it("FAIL when header missing", () => {
    const result = validateCsp(null);
    expect(result.status).toBe("FAIL");
  });

  it("WARN when default-src missing", () => {
    const result = validateCsp("script-src 'self'");
    expect(result.status).toBe("WARN");
  });

  it("PASS when default-src present", () => {
    const result = validateCsp("default-src 'self'; script-src 'self'");
    expect(result.status).toBe("PASS");
  });
});

describe("validateXContentTypeOptions", () => {
  it("FAIL when header missing", () => {
    const result = validateXContentTypeOptions(null);
    expect(result.status).toBe("FAIL");
  });

  it("FAIL when value is not nosniff", () => {
    const result = validateXContentTypeOptions("sniff");
    expect(result.status).toBe("FAIL");
  });

  it("PASS when value is nosniff", () => {
    const result = validateXContentTypeOptions("nosniff");
    expect(result.status).toBe("PASS");
  });

  it("PASS when value is NOSNIFF (case-insensitive)", () => {
    const result = validateXContentTypeOptions("NOSNIFF");
    expect(result.status).toBe("PASS");
  });
});

describe("validateXFrameOptions", () => {
  it("FAIL when header missing", () => {
    const result = validateXFrameOptions(null);
    expect(result.status).toBe("FAIL");
  });

  it("WARN when value is not DENY or SAMEORIGIN", () => {
    const result = validateXFrameOptions("ALLOWALL");
    expect(result.status).toBe("WARN");
  });

  it("PASS when value is DENY", () => {
    const result = validateXFrameOptions("DENY");
    expect(result.status).toBe("PASS");
  });

  it("PASS when value is SAMEORIGIN", () => {
    const result = validateXFrameOptions("SAMEORIGIN");
    expect(result.status).toBe("PASS");
  });
});

describe("validateReferrerPolicy", () => {
  it("WARN when header missing", () => {
    const result = validateReferrerPolicy(null);
    expect(result.status).toBe("WARN");
  });

  it("WARN for unsafe policy", () => {
    const result = validateReferrerPolicy("unsafe-url");
    expect(result.status).toBe("WARN");
  });

  it("PASS for strict-origin-when-cross-origin", () => {
    const result = validateReferrerPolicy("strict-origin-when-cross-origin");
    expect(result.status).toBe("PASS");
  });

  it("PASS for no-referrer", () => {
    const result = validateReferrerPolicy("no-referrer");
    expect(result.status).toBe("PASS");
  });
});

describe("validatePermissionsPolicy", () => {
  it("WARN when header missing", () => {
    const result = validatePermissionsPolicy(null);
    expect(result.status).toBe("WARN");
  });

  it("PASS when header present", () => {
    const result = validatePermissionsPolicy("camera=(), microphone=()");
    expect(result.status).toBe("PASS");
  });
});

describe("buildReport", () => {
  it("overall is FAIL when any result is FAIL", () => {
    const report = buildReport("http://localhost:3000", {
      "strict-transport-security": null,
      "content-security-policy": "default-src 'self'",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=()",
    });
    expect(report.overall).toBe("FAIL");
    expect(report.results).toHaveLength(6);
  });

  it("overall is WARN when any result is WARN but no FAIL", () => {
    const report = buildReport("http://localhost:3000", {
      "strict-transport-security": "max-age=31536000",
      "content-security-policy": "default-src 'self'",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": null,
      "permissions-policy": null,
    });
    expect(report.overall).toBe("WARN");
  });

  it("overall is PASS when all results pass", () => {
    const report = buildReport("https://twicely.co", {
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "content-security-policy": "default-src 'self'",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=()",
    });
    expect(report.overall).toBe("PASS");
    expect(report.url).toBe("https://twicely.co");
    expect(report.timestamp).toBeTruthy();
  });
});
