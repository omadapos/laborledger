import { describe, expect, it } from "vitest";

import {
  assignmentDisclaimer,
  formatAssignedEmployeeLabel,
  formatResponsibilityLogAction,
  formatResponsibilityLogSummary,
  formatServiceLineCompletionStatus,
  formatServiceLineCompletionSummary,
  formatWorkOrderCompletionProgress,
  formatWorkOrderMoney,
  formatWorkOrderStatusLabel,
  sumServiceLineTotals,
  workOrderDisclaimer,
  workOrdersEmptyMessage
} from "../../apps/admin/src/lib/work-order-utils";

describe("work-order-utils", () => {
  it("formats work order status labels", () => {
    expect(formatWorkOrderStatusLabel("DRAFT")).toBe("Draft");
    expect(formatWorkOrderStatusLabel("READY")).toBe("Ready");
    expect(formatWorkOrderStatusLabel("ASSIGNED")).toBe("Assigned");
    expect(formatWorkOrderStatusLabel("IN_PROGRESS")).toBe("In progress");
    expect(formatWorkOrderStatusLabel("COMPLETED")).toBe("Completed");
    expect(formatWorkOrderStatusLabel("INVOICED")).toBe("Invoiced");
    expect(formatWorkOrderStatusLabel("CANCELLED")).toBe("Cancelled");
  });

  it("formats assigned employee summary and unassigned label", () => {
    expect(formatAssignedEmployeeLabel(null)).toBe("Unassigned");
    expect(formatAssignedEmployeeLabel({ id: "e1", fullName: "Maria Gomez" })).toBe("Maria Gomez");
  });

  it("formats responsibility log labels", () => {
    expect(formatResponsibilityLogAction("ASSIGNED")).toBe("Assigned");
    expect(formatResponsibilityLogAction("RESPONSIBILITY_CONFIRMED")).toBe("Responsibility confirmed");
    expect(formatResponsibilityLogAction("SERVICE_COMPLETED")).toBe("Service completed");
    expect(
      formatResponsibilityLogSummary({
        id: "log-1",
        employeeId: "e1",
        action: "ASSIGNED",
        occurredAt: "2026-06-21T12:00:00.000Z",
        details: null,
        employee: { id: "e1", fullName: "Maria Gomez" }
      })
    ).toBe("Assigned — Maria Gomez");
  });

  it("uses assignment disclaimer that excludes payroll and kiosk replacement", () => {
    const copy = assignmentDisclaimer();
    expect(copy.toLowerCase()).toContain("not payroll");
    expect(copy.toLowerCase()).toContain("kiosk punches");
    expect(copy.toLowerCase()).not.toContain("issue invoice");
  });

  it("formats service line totals and money", () => {
    expect(sumServiceLineTotals([{ lineTotalMinor: 12500 }, { lineTotalMinor: 9900 }])).toBe(22400);
    expect(formatWorkOrderMoney(12500)).toBe("$125.00");
  });

  it("uses disclaimer that excludes invoice and payroll language", () => {
    const copy = workOrderDisclaimer();
    expect(copy.toLowerCase()).toContain("not invoices");
    expect(copy.toLowerCase()).toContain("payroll");
    expect(copy.toLowerCase()).not.toContain("issue invoice");
  });

  it("provides empty and filtered empty helper copy", () => {
    expect(workOrdersEmptyMessage(false).title).toBe("No work orders yet");
    expect(workOrdersEmptyMessage(true).title).toBe("No work orders match your filters");
  });

  it("formats service line completion status and progress", () => {
    expect(formatServiceLineCompletionStatus(null)).toBe("Pending");
    expect(formatServiceLineCompletionStatus({ id: "c1", completedAt: "2026-06-21T12:00:00.000Z", employee: { id: "e1", fullName: "Maria Gomez" } })).toBe("Completed");
    expect(
      formatServiceLineCompletionSummary({
        id: "c1",
        completedAt: "2026-06-21T12:00:00.000Z",
        employee: { id: "e1", fullName: "Maria Gomez" }
      })
    ).toContain("Maria Gomez");
    expect(
      formatWorkOrderCompletionProgress({
        completedServiceLineCount: 2,
        serviceLineCount: 3
      })
    ).toBe("2 of 3 services completed");
  });
});
