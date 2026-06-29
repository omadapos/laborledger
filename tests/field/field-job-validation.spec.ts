import { describe, expect, it } from "vitest";

import {
  assertCatalogItemAllowed,
  assertExistingVehicleMatchesSelection,
  assertLocationAllowed,
  assertServiceClientAllowed,
  validateFieldJobCreateInput
} from "../../apps/api/src/modules/worker/field-job-validation";

describe("field-job-validation", () => {
  it("rejects missing VIN", () => {
    expect(
      validateFieldJobCreateInput({
        serviceClientId: "client-1",
        locationId: "loc-1",
        serviceCatalogItemId: "svc-1"
      })
    ).toBe("VIN is required.");
  });

  it("rejects service client outside company", () => {
    expect(
      assertServiceClientAllowed({ id: "client-1", companyId: "other-company", archivedAt: null }, "company-1")
    ).toMatch(/customer/i);
  });

  it("rejects location outside company", () => {
    expect(
      assertLocationAllowed(
        { id: "loc-1", companyId: "other-company", serviceClientId: "client-1", archivedAt: null },
        "company-1",
        "client-1"
      )
    ).toMatch(/location/i);
  });

  it("rejects location for wrong customer", () => {
    expect(
      assertLocationAllowed(
        { id: "loc-1", companyId: "company-1", serviceClientId: "client-2", archivedAt: null },
        "company-1",
        "client-1"
      )
    ).toMatch(/customer/i);
  });

  it("rejects catalog item outside company", () => {
    expect(
      assertCatalogItemAllowed(
        { id: "svc-1", companyId: "other-company", archivedAt: null },
        "company-1"
      )
    ).toMatch(/service/i);
  });

  it("rejects existing vehicle with mismatched customer or location", () => {
    expect(
      assertExistingVehicleMatchesSelection({
        vehicle: {
          serviceClientId: "client-a",
          locationId: "loc-a",
          archivedAt: null
        },
        serviceClientId: "client-b",
        locationId: "loc-b"
      })
    ).toMatch(/different customer or location/i);
  });

  it("accepts valid create input", () => {
    expect(
      validateFieldJobCreateInput({
        enteredVin: "1HGBH41JXMN109186",
        serviceClientId: "client-1",
        locationId: "loc-1",
        serviceCatalogItemId: "svc-1"
      })
    ).toBeNull();
  });
});
