import { describe, expect, it } from "vitest";

import {
  enrichLocations,
  filterLocationsByQuery,
  isValidIanaTimeZone,
  validateLocationName,
  validateLocationTimeZone
} from "../../apps/admin/src/lib/location-utils";

describe("location-utils", () => {
  it("requires a location name", () => {
    expect(validateLocationName("")).toBe("Location name is required.");
    expect(validateLocationName("Downtown HQ")).toBeNull();
  });

  it("validates IANA time zones", () => {
    expect(isValidIanaTimeZone("America/New_York")).toBe(true);
    expect(isValidIanaTimeZone("Invalid/Timezone")).toBe(false);
    expect(validateLocationTimeZone("Invalid/Timezone")).toBe(
      "Time zone must be a valid IANA identifier (for example, America/New_York)."
    );
  });

  it("filters locations by name, client, and time zone", () => {
    const locations = enrichLocations(
      [
        {
          id: "1",
          companyId: "c1",
          serviceClientId: "sc1",
          name: "Downtown HQ",
          timezone: "America/New_York",
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      [{ id: "sc1", name: "Acme Facilities", archivedAt: null }]
    );

    expect(filterLocationsByQuery(locations, "acme")).toHaveLength(1);
    expect(filterLocationsByQuery(locations, "chicago")).toHaveLength(0);
  });

  it("enriches locations with service client names", () => {
    const views = enrichLocations(
      [
        {
          id: "1",
          companyId: "c1",
          serviceClientId: "sc1",
          name: "Warehouse",
          timezone: "America/Chicago",
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      [{ id: "sc1", name: "Northwind", archivedAt: null }]
    );

    expect(views[0]?.serviceClientName).toBe("Northwind");
    expect(views[0]?.timezone).toBe("America/Chicago");
  });
});
