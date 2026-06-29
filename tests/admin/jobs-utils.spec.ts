import { describe, expect, it } from "vitest";

import {
  buildJobsClearFiltersHref,
  countAssignedWorkers,
  formatJobInvoiceStatus,
  formatJobStatusLabel,
  hasActiveJobsFilters,
  jobsEmptyMessage,
  jobDetailRoute,
  receptionRoute
} from "../../apps/admin/src/lib/jobs-utils";

describe("jobs-utils", () => {
  it("formats job status and invoice labels", () => {
    expect(formatJobStatusLabel("READY")).toBe("Ready");
    expect(formatJobInvoiceStatus("INVOICED")).toBe("Invoiced");
    expect(formatJobInvoiceStatus("COMPLETED")).toBe("Ready to invoice");
    expect(formatJobInvoiceStatus("READY")).toBe("Not invoiced");
  });

  it("counts assigned workers and builds routes", () => {
    expect(
      countAssignedWorkers({
        assignments: [
          {
            id: "a1",
            employeeId: "e1",
            workOrderServiceLineId: null,
            roleLabel: null,
            assignedAt: "2026-06-23T00:00:00.000Z",
            unassignedAt: null,
            unassignReason: null,
            employee: { id: "e1", fullName: "Maria" }
          },
          {
            id: "a2",
            employeeId: "e1",
            workOrderServiceLineId: "line1",
            roleLabel: null,
            assignedAt: "2026-06-23T00:00:00.000Z",
            unassignedAt: null,
            unassignReason: null,
            employee: { id: "e1", fullName: "Maria" }
          }
        ]
      })
    ).toBe(1);
    expect(receptionRoute()).toBe("/reception");
    expect(jobDetailRoute("wo1")).toBe("/jobs/wo1");
    expect(buildJobsClearFiltersHref()).toBe("/jobs");
  });

  it("detects active jobs list filters", () => {
    expect(hasActiveJobsFilters({})).toBe(false);
    expect(hasActiveJobsFilters({ q: "  " })).toBe(false);
    expect(hasActiveJobsFilters({ q: "5J6RM4H75DL028637" })).toBe(true);
    expect(hasActiveJobsFilters({ status: "READY" })).toBe(true);
    expect(hasActiveJobsFilters({ serviceClientId: "sc1" })).toBe(true);
    expect(hasActiveJobsFilters({ locationId: "loc1" })).toBe(true);
  });

  it("returns default empty state copy when no filters are active", () => {
    expect(jobsEmptyMessage({})).toEqual({
      title: "No jobs yet",
      description: "No jobs yet. Receive a vehicle to create the first work order."
    });
  });

  it("returns filtered empty state copy when search or status filters are active", () => {
    expect(jobsEmptyMessage({ q: "5J6RM4H75DL028637" })).toEqual({
      title: "No matching jobs found",
      description: "Try adjusting your filters or clearing the search."
    });
    expect(jobsEmptyMessage({ status: "COMPLETED" })).toEqual({
      title: "No matching jobs found",
      description: "Try adjusting your filters or clearing the search."
    });
  });
});
