import { describe, expect, it } from "vitest";

import {
  fieldJobCreationRequiredMessage,
  findAssignmentById,
  findAssignmentByVin,
  pendingServiceLines
} from "../../apps/field/src/lib/field-job-utils";
import type { WorkerAssignmentRecord } from "../../apps/field/src/lib/worker-utils";

const SAMPLE_ASSIGNMENTS: WorkerAssignmentRecord[] = [
  {
    assignmentId: "assign-1",
    workOrderId: "wo-1",
    workOrderNumber: "WO-1001",
    status: "ASSIGNED",
    vehicle: {
      vin: "1HGBH41JXMN109186",
      year: 2021,
      make: "Honda",
      model: "Accord",
      plate: "ABC123",
      color: "Silver"
    },
    location: { id: "loc-1", name: "Downtown Service" },
    serviceLines: [
      {
        id: "line-1",
        serviceNameSnapshot: "Oil Change",
        serviceCategorySnapshot: "Maintenance",
        completion: null
      }
    ],
    lastConfirmation: null
  }
];

describe("field-job-utils", () => {
  it("finds assignment by VIN", () => {
    expect(findAssignmentByVin(SAMPLE_ASSIGNMENTS, "1HGBH41JXMN109186")?.assignmentId).toBe(
      "assign-1"
    );
    expect(findAssignmentByVin(SAMPLE_ASSIGNMENTS, "INVALID")).toBeNull();
  });

  it("finds assignment by id", () => {
    expect(findAssignmentById(SAMPLE_ASSIGNMENTS, "assign-1")?.workOrderNumber).toBe("WO-1001");
    expect(findAssignmentById(SAMPLE_ASSIGNMENTS, "missing")).toBeNull();
  });

  it("returns pending service lines", () => {
    expect(pendingServiceLines(SAMPLE_ASSIGNMENTS[0]!).map((line) => line.id)).toEqual(["line-1"]);
  });

  it("documents assignment-required job creation message", () => {
    expect(fieldJobCreationRequiredMessage()).toMatch(/supervisor/i);
  });
});
