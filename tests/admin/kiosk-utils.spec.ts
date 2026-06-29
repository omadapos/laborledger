import { describe, expect, it } from "vitest";

import {
  credentialStatusLabel,
  filterKiosksByQuery,
  formatKioskEnvBlock,
  locationsAvailableForKiosk,
  validateKioskLocationId,
  validateKioskName
} from "../../apps/admin/src/lib/kiosk-utils";

describe("kiosk-utils", () => {
  it("requires kiosk name and location", () => {
    expect(validateKioskName("")).toBe("Kiosk name is required.");
    expect(validateKioskName("Front desk")).toBeNull();
    expect(validateKioskLocationId("")).toBe("Location is required.");
    expect(validateKioskLocationId("loc-1")).toBeNull();
  });

  it("labels credential status for badges", () => {
    expect(credentialStatusLabel("active")).toBe("Active credential");
    expect(credentialStatusLabel("revoked")).toBe("Revoked credential");
    expect(credentialStatusLabel("missing")).toBe("No credential");
  });

  it("filters kiosks by name or location", () => {
    const kiosks = [
      {
        id: "k1",
        name: "Lobby Kiosk",
        companyId: "c1",
        locationId: "l1",
        locationName: "Downtown HQ",
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        credentialStatus: "active" as const,
        credentialCreatedAt: "2026-01-01T00:00:00.000Z"
      }
    ];

    expect(filterKiosksByQuery(kiosks, "lobby")).toHaveLength(1);
    expect(filterKiosksByQuery(kiosks, "downtown")).toHaveLength(1);
    expect(filterKiosksByQuery(kiosks, "warehouse")).toHaveLength(0);
  });

  it("formats kiosk deployment env block", () => {
    expect(
      formatKioskEnvBlock({
        kioskId: "kiosk-123",
        kioskSecret: "secret-abc",
        apiUrl: "http://127.0.0.1:4000"
      })
    ).toBe(
      "KIOSK_ID=kiosk-123\nKIOSK_SECRET=secret-abc\nAPI_BASE_URL=http://127.0.0.1:4000"
    );
  });

  it("excludes occupied active locations from create options", () => {
    const locations = [
      { id: "l1", name: "Site A", archivedAt: null },
      { id: "l2", name: "Site B", archivedAt: null },
      { id: "l3", name: "Inactive Site", archivedAt: "2026-01-02T00:00:00.000Z" }
    ];
    const kiosks = [
      {
        id: "k1",
        name: "Kiosk A",
        companyId: "c1",
        locationId: "l1",
        locationName: "Site A",
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        credentialStatus: "active" as const,
        credentialCreatedAt: "2026-01-01T00:00:00.000Z"
      }
    ];

    expect(locationsAvailableForKiosk(locations, kiosks)).toEqual([{ id: "l2", name: "Site B", archivedAt: null }]);
  });
});
