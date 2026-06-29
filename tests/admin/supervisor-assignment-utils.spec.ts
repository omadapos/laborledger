import { describe, expect, it } from "vitest";

import {
  buildAssignSupervisorLocationPath,
  buildRemoveSupervisorLocationPath,
  formatAssignedLocationCount,
  formatSupervisorLabel,
  groupAssignmentsBySupervisor,
  SUPERVISOR_ACCESS_HELPER_COPY,
  SUPERVISOR_PIN_HELPER_COPY,
  supervisorAccessEmptyMessage,
  validateSupervisorAssignmentInput
} from "../../apps/admin/src/lib/supervisor-assignment-utils";

describe("SUP02 supervisor assignment admin utils", () => {
  it("formats supervisor labels and assigned location counts", () => {
    expect(formatSupervisorLabel({ fullName: "Alex Supervisor", email: "alex@example.com" })).toBe(
      "Alex Supervisor"
    );
    expect(formatSupervisorLabel({ fullName: null, email: "alex@example.com" })).toBe("alex@example.com");
    expect(formatAssignedLocationCount(0)).toBe("No locations assigned");
    expect(formatAssignedLocationCount(1)).toBe("1 assigned location");
    expect(formatAssignedLocationCount(2)).toBe("2 assigned locations");
  });

  it("groups assignments by supervisor user id", () => {
    const grouped = groupAssignmentsBySupervisor([
      {
        id: "a1",
        companyId: "c1",
        supervisorUserId: "u1",
        locationId: "l1",
        assignedAt: "2026-01-01T00:00:00.000Z",
        supervisor: { id: "u1", email: "s1@example.com", fullName: "S1" },
        location: { id: "l1", name: "Site 1", timezone: "UTC", archivedAt: null }
      },
      {
        id: "a2",
        companyId: "c1",
        supervisorUserId: "u1",
        locationId: "l2",
        assignedAt: "2026-01-02T00:00:00.000Z",
        supervisor: { id: "u1", email: "s1@example.com", fullName: "S1" },
        location: { id: "l2", name: "Site 2", timezone: "UTC", archivedAt: null }
      }
    ]);

    expect(grouped.get("u1")).toHaveLength(2);
  });

  it("builds assign and remove API paths", () => {
    expect(buildAssignSupervisorLocationPath("company-1", "supervisor-1")).toBe(
      "/api/company-operations/companies/company-1/supervisors/supervisor-1/locations"
    );
    expect(buildRemoveSupervisorLocationPath("company-1", "supervisor-1", "location-1")).toBe(
      "/api/company-operations/companies/company-1/supervisors/supervisor-1/locations/location-1"
    );
  });

  it("returns empty-state copy for supervisors and locations", () => {
    expect(supervisorAccessEmptyMessage([], []).title).toBe("No locations available");
    expect(supervisorAccessEmptyMessage([], [{ id: "l1", name: "Site", timezone: "UTC" }]).title).toBe(
      "No supervisors yet"
    );
    expect(
      supervisorAccessEmptyMessage(
        [{ userId: "u1", email: "s@example.com", fullName: "S", role: "SUPERVISOR", assignedLocationCount: 0 }],
        [{ id: "l1", name: "Site", timezone: "UTC" }]
      ).title
    ).toBe("No location assignments yet");
  });

  it("validates assignment form input", () => {
    expect(validateSupervisorAssignmentInput("", "location-1")).toBe("Select a supervisor.");
    expect(validateSupervisorAssignmentInput("supervisor-1", "")).toBe("Select a location.");
    expect(validateSupervisorAssignmentInput("supervisor-1", "location-1")).toBeNull();
  });

  it("includes supervisor scope helper copy", () => {
    expect(SUPERVISOR_ACCESS_HELPER_COPY).toContain("assigned locations");
    expect(SUPERVISOR_PIN_HELPER_COPY.toLowerCase()).toContain("pin");
  });
});
