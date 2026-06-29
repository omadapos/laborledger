import { describe, expect, it } from "vitest";

import {
  MAX_OPERATIONS_REPORT_RANGE_DAYS,
  resolveOperationsReportDateRange
} from "../src/modules/operations-reports/operations-reports-date-range";

describe("operations-reports-date-range", () => {
  it("defaults to current month through today in UTC", () => {
    const now = new Date();
    const range = resolveOperationsReportDateRange();

    expect(range.from.endsWith(`-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`)).toBe(true);
    expect(range.to).toBe(now.toISOString().slice(0, 10));
  });

  it("rejects invalid and inverted ranges", () => {
    expect(() => resolveOperationsReportDateRange("2026-06-10", "2026-06-01")).toThrow(/from must be on or before to/i);
    expect(() => resolveOperationsReportDateRange("bad-date", "2026-06-01")).toThrow(/from must use YYYY-MM-DD/i);
  });

  it("rejects ranges larger than the configured maximum", () => {
    expect(() =>
      resolveOperationsReportDateRange("2024-01-01", "2026-06-22")
    ).toThrow(new RegExp(`${MAX_OPERATIONS_REPORT_RANGE_DAYS} days`, "i"));
  });
});
