import { describe, expect, it } from "vitest";

import {
  blockerTypeLabel,
  formatEstimateAmount,
  formatPayableHours,
  formatWeekRange,
  groupBlockersByType,
  validateReopenReason,
  weeklyStatusLabel
} from "../../apps/admin/src/lib/weekly-close-utils";

describe("weekly close utils", () => {
  it("formats week range and payable hours", () => {
    expect(formatWeekRange("2026-04-06", "2026-04-12")).toBe("2026-04-06 – 2026-04-12");
    expect(formatPayableHours(450)).toBe("7h 30m");
  });

  it("formats estimate amounts", () => {
    expect(formatEstimateAmount(14250, "USD")).toBe("$142.50");
  });

  it("labels weekly status badges", () => {
    expect(weeklyStatusLabel("CLOSED")).toBe("Closed");
    expect(weeklyStatusLabel("REOPENED")).toBe("Reopened");
  });

  it("groups blockers by type", () => {
    const groups = groupBlockersByType([
      { code: "missing_clock_out", message: "A" },
      { code: "missing_clock_out", message: "B" },
      { code: "pending_correction", message: "C" }
    ]);

    expect(groups).toHaveLength(2);
    expect(blockerTypeLabel("pending_correction")).toBe("Pending correction");
  });

  it("validates reopen reason", () => {
    expect(validateReopenReason("")).toBe("Reopen reason is required.");
    expect(validateReopenReason("short")).toContain("8 characters");
    expect(validateReopenReason("Payroll found a missed approval.")).toBeNull();
  });
});
