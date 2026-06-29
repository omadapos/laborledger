import { describe, expect, it } from "vitest";

import {
  filterLocationsForAccess,
  hasAssignedLocations,
  isSupervisorAccess,
  supervisorScopeEmptyMessage,
  type CompanyAccessContext
} from "../../apps/admin/src/lib/supervisor-scope-utils";

const supervisorNoLocations: CompanyAccessContext = {
  companyId: "c1",
  accessLevel: "supervisor",
  unrestrictedLocations: false,
  allowedLocationIds: [],
  canManageCompany: false,
  canAccessWeeklyClose: false,
  canAccessKioskAdmin: false
};

const supervisorWithLocations: CompanyAccessContext = {
  ...supervisorNoLocations,
  allowedLocationIds: ["l1"]
};

const companyAdmin: CompanyAccessContext = {
  companyId: "c1",
  accessLevel: "company_admin",
  unrestrictedLocations: true,
  allowedLocationIds: [],
  canManageCompany: true,
  canAccessWeeklyClose: true,
  canAccessKioskAdmin: true
};

describe("supervisor-scope-utils", () => {
  it("detects supervisor access and assigned locations", () => {
    expect(isSupervisorAccess(supervisorNoLocations)).toBe(true);
    expect(hasAssignedLocations(supervisorNoLocations)).toBe(false);
    expect(hasAssignedLocations(supervisorWithLocations)).toBe(true);
    expect(isSupervisorAccess(companyAdmin)).toBe(false);
  });

  it("returns empty-scope message only for supervisors without locations", () => {
    expect(supervisorScopeEmptyMessage(supervisorNoLocations)).toContain("No locations are assigned");
    expect(supervisorScopeEmptyMessage(supervisorWithLocations)).toBeNull();
    expect(supervisorScopeEmptyMessage(companyAdmin)).toBeNull();
  });

  it("filters locations to allowed ids for supervisors", () => {
    const locations = [
      { id: "l1", name: "Site A" },
      { id: "l2", name: "Site B" }
    ];

    expect(filterLocationsForAccess(locations, supervisorWithLocations)).toEqual([{ id: "l1", name: "Site A" }]);
    expect(filterLocationsForAccess(locations, companyAdmin)).toEqual(locations);
  });
});
