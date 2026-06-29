import { computeReferenceMinutes, findActiveClockedInShift } from "../src/modules/labor-work-assignment/labor-work-assignment.utils";
import {
  buildClientBillingCsvWithWorkContext,
  buildClientBillingWorkContextRow
} from "../src/modules/labor-pay-billing/labor-pay-billing";
import { PunchAction } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("labor work assignment utils", () => {
  it("finds an active clocked-in shift", () => {
    const shift = findActiveClockedInShift([
      {
        punchEvents: [
          {
            action: PunchAction.CLOCK_IN,
            eventUtc: new Date("2026-04-06T13:00:00.000Z"),
            breakMinutes: null
          }
        ]
      }
    ]);

    expect(shift).not.toBeNull();
  });

  it("computes reference minutes without using them for billing charge", () => {
    const startedAt = new Date("2026-04-06T13:00:00.000Z");
    const completedAt = new Date("2026-04-06T15:00:00.000Z");

    const reference = computeReferenceMinutes({
      referencePrepStartedAt: new Date("2026-04-06T13:00:00.000Z"),
      referencePrepCompletedAt: new Date("2026-04-06T13:20:00.000Z"),
      referenceWashStartedAt: new Date("2026-04-06T13:20:00.000Z"),
      referenceWashCompletedAt: new Date("2026-04-06T13:50:00.000Z"),
      startedAt,
      completedAt
    });

    expect(reference.referencePrepMinutes).toBe(20);
    expect(reference.referenceWashMinutes).toBe(30);
    expect(reference.referenceServiceMinutes).toBe(120);

    const billingRow = buildClientBillingWorkContextRow(
      {
        serviceClientId: "client-1",
        serviceClientName: "Client A",
        locationId: "loc-1",
        locationName: "Site 1",
        employeeId: "emp-1",
        employeeName: "Worker",
        periodStart: "2026-04-06",
        periodEnd: "2026-04-12",
        approvedBillableMinutes: 240,
        approvedBillableHoursDecimal: 4,
        clientLaborRateMinor: 2300,
        estimatedClientChargeMinor: 9200,
        estimatedGrossPayMinor: 7600,
        estimatedMarginMinor: 1600,
        shiftCount: 1,
        warnings: []
      },
      "2026-04-06",
      {
        addressSnapshot: "Site 1",
        serviceNameSnapshot: "Detail",
        status: "COMPLETED",
        progressPercent: 100,
        referencePrepMinutes: reference.referencePrepMinutes,
        referenceWashMinutes: reference.referenceWashMinutes,
        referenceServiceMinutes: reference.referenceServiceMinutes
      }
    );

    const csv = buildClientBillingCsvWithWorkContext([billingRow]);
    expect(csv).toContain("reference_prep_minutes");
    expect(csv).toContain("20");
    expect(csv).toContain("92.00");
    expect(billingRow.estimatedClientChargeMinor).toBe(9200);
    expect(billingRow.estimatedClientChargeMinor).not.toBe(
      (reference.referenceServiceMinutes ?? 0) * billingRow.laborRateMinor
    );
  });
});
