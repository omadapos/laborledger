import { describe, expect, it } from "vitest";

import {
  enrichServiceClientsWithLocationCounts,
  filterServiceClientsByQuery,
  validateServiceClientName
} from "../../apps/admin/src/lib/service-client-utils";

describe("service-client-utils", () => {
  it("rejects empty service client name", () => {
    expect(validateServiceClientName("")).toBe("Service client name is required.");
    expect(validateServiceClientName("   ")).toBe("Service client name is required.");
    expect(validateServiceClientName("Acme")).toBeUndefined();
  });

  it("filters service clients by name", () => {
    const clients = enrichServiceClientsWithLocationCounts(
      [
        {
          id: "1",
          companyId: "c1",
          name: "Acme Facilities",
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z"
        },
        {
          id: "2",
          companyId: "c1",
          name: "Northwind Services",
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      []
    );

    expect(filterServiceClientsByQuery(clients, "acme")).toHaveLength(1);
    expect(filterServiceClientsByQuery(clients, "")).toHaveLength(2);
  });

  it("counts only active locations per service client", () => {
    const views = enrichServiceClientsWithLocationCounts(
      [
        {
          id: "sc1",
          companyId: "c1",
          name: "Acme",
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      [
        { serviceClientId: "sc1", archivedAt: null },
        { serviceClientId: "sc1", archivedAt: "2026-02-01T00:00:00.000Z" },
        { serviceClientId: "sc2", archivedAt: null }
      ]
    );

    expect(views[0]?.locationCount).toBe(1);
  });
});
