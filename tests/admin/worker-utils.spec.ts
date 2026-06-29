import { describe, expect, it } from "vitest";

import {
  canCompleteServiceLine,
  formatAssignmentSummary,
  formatServiceLineCompletionLabel,
  normalizeVinInput,
  serviceCompletionBlockedMessage,
  serviceCompletionSuccessMessage,
  workerDisclaimer,
  workerEmptyAssignmentsMessage
} from "../../apps/field/src/lib/worker-utils";

describe("worker-utils", () => {
  it("normalizes manual VIN input", () => {
    expect(normalizeVinInput(" 1hgbh41jxmn109186 ")).toBe("1HGBH41JXMN109186");
    expect(normalizeVinInput("1HGBH41JXMN10918I")).toBe("1HGBH41JXMN10918");
  });

  it("formats assignment card summary", () => {
    expect(
      formatAssignmentSummary({
        assignmentId: "a1",
        workOrderId: "wo1",
        workOrderNumber: "WO-20260621-0001",
        status: "ASSIGNED",
        vehicle: {
          vin: "1HGBH41JXMN109186",
          year: 2020,
          make: "Honda",
          model: "Civic",
          plate: "ABC123",
          color: "Blue"
        },
        location: { id: "loc1", name: "Main Shop" },
        serviceLines: [],
        lastConfirmation: null
      })
    ).toContain("WO-20260621-0001");
  });

  it("formats service completion helpers", () => {
    expect(formatServiceLineCompletionLabel(null)).toBe("Pending");
    expect(formatServiceLineCompletionLabel({ serviceCompletionId: "c1", completedAt: "2026-06-21T12:00:00.000Z", completedByEmployeeId: "e1", completedByEmployeeName: "Maria Gomez" })).toBe("Completed");
    expect(serviceCompletionSuccessMessage().toLowerCase()).toContain("does not replace time clock punches");
    expect(serviceCompletionBlockedMessage().toLowerCase()).toContain("confirm");
    expect(
      canCompleteServiceLine({
        assignmentId: "a1",
        workOrderId: "wo1",
        workOrderNumber: "WO-1",
        status: "ASSIGNED",
        vehicle: { vin: "1", year: null, make: null, model: null, plate: null, color: null },
        location: { id: "loc1", name: "Main" },
        serviceLines: [],
        lastConfirmation: null
      })
    ).toBe(false);
    expect(
      canCompleteServiceLine({
        assignmentId: "a1",
        workOrderId: "wo1",
        workOrderNumber: "WO-1",
        status: "ASSIGNED",
        vehicle: { vin: "1", year: null, make: null, model: null, plate: null, color: null },
        location: { id: "loc1", name: "Main" },
        serviceLines: [],
        lastConfirmation: { scanEventId: "s1", acceptedAt: "2026-06-21T12:00:00.000Z", enteredVin: "VIN" }
      })
    ).toBe(true);
  });

  it("uses disclaimer that excludes time clock replacement", () => {
    const copy = workerDisclaimer();
    expect(copy.toLowerCase()).toContain("does not replace time clock punches");
    expect(copy.toLowerCase()).not.toContain("payroll");
  });

  it("provides empty assignment helper copy", () => {
    expect(workerEmptyAssignmentsMessage().title).toBe("No active assignments");
  });
});
