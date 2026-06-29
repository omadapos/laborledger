import { describe, expect, it } from "vitest";

import {
  buildReceptionVehiclePayload,
  buildReceptionWorkOrderPayload,
  formatDecodedVehicleSummary,
  isReceptionBlockedForSupervisor,
  jobDetailRoute,
  jobsRoute,
  normalizeVinDisplay,
  receptionRoute,
  RECEPTION_GO_TO_JOBS_CTA,
  RECEPTION_SUPERVISOR_BLOCKED_LINE_1,
  validateReceptionForm
} from "../../apps/admin/src/lib/reception-utils";

describe("reception-utils", () => {
  const form = {
    serviceClientId: "sc1",
    locationId: "loc1",
    vin: " 1hgbh41jxmn109186 ",
    plate: " ABC123 ",
    color: "",
    notes: "",
    selectedCatalogIds: ["cat1"],
    workOrderNotes: "Customer waiting"
  };

  it("builds routes and normalizes VIN display", () => {
    expect(receptionRoute()).toBe("/reception");
    expect(jobsRoute()).toBe("/jobs");
    expect(jobDetailRoute("wo1")).toBe("/jobs/wo1");
    expect(normalizeVinDisplay(" 1hgbh41jxmn109186 ")).toBe("1HGBH41JXMN109186");
  });

  it("builds reception payloads", () => {
    expect(buildReceptionVehiclePayload(form)).toEqual({
      vin: "1HGBH41JXMN109186",
      serviceClientId: "sc1",
      locationId: "loc1",
      plate: "ABC123"
    });
    expect(buildReceptionWorkOrderPayload("veh1", form)).toEqual({
      vehicleId: "veh1",
      serviceCatalogItemIds: ["cat1"],
      status: "READY",
      notes: "Customer waiting"
    });
  });

  it("validates reception form", () => {
    expect(validateReceptionForm(form, { activeCatalogCount: 1 })).toEqual({});
    expect(validateReceptionForm({ ...form, vin: "" }, { activeCatalogCount: 1 }).vin).toBe(
      "VIN is required."
    );
  });

  it("formats decoded vehicle summary", () => {
    expect(
      formatDecodedVehicleSummary({
        vin: "1HGBH41JXMN109186",
        year: 2021,
        make: "Honda",
        model: "Civic",
        trim: "EX"
      })
    ).toBe("2021 Honda Civic · EX");
  });

  it("exposes supervisor reception blocked helpers", () => {
    expect(isReceptionBlockedForSupervisor(false)).toBe(true);
    expect(isReceptionBlockedForSupervisor(true)).toBe(false);
    expect(RECEPTION_SUPERVISOR_BLOCKED_LINE_1).toContain("company admins");
    expect(RECEPTION_GO_TO_JOBS_CTA).toBe("Go to Jobs");
    expect(jobsRoute()).toBe("/jobs");
  });
});
