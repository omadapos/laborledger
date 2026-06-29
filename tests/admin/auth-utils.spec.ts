import { describe, expect, it } from "vitest";

import {
  formatActiveCompanyLabel,
  formatChooseCompanyBlockedCopy,
  formatCompanyAccessLabel,
  resolveLoginRedirectPath
} from "../../apps/admin/src/lib/auth-utils";

describe("auth-utils", () => {
  it("formats company access labels", () => {
    expect(formatCompanyAccessLabel("PLATFORM_SUPERADMIN")).toBe("Platform superadmin");
    expect(formatCompanyAccessLabel("GROUP_OWNER")).toBe("Group owner");
    expect(formatCompanyAccessLabel("COMPANY_ADMIN")).toBe("Company admin");
    expect(formatCompanyAccessLabel("SUPERVISOR")).toBe("Supervisor");
  });

  it("formats active company label with access role", () => {
    expect(formatActiveCompanyLabel(null)).toBe("No company selected");
    expect(
      formatActiveCompanyLabel({
        id: "c1",
        groupId: "g1",
        name: "Family Autobody and Sale Corp",
        currencyCode: "USD",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        accessRole: "COMPANY_ADMIN",
        accessLabel: "Company admin"
      })
    ).toBe("Family Autobody and Sale Corp · Company admin");
  });

  it("returns blocked copy for users without company access", () => {
    expect(formatChooseCompanyBlockedCopy()).toContain("no company workspace");
  });

  it("resolves login redirect paths", () => {
    expect(resolveLoginRedirectPath("dashboard")).toBe("/employees");
    expect(resolveLoginRedirectPath("choose-company")).toBe("/choose-company");
    expect(resolveLoginRedirectPath("blocked")).toBe("/choose-company?blocked=1");
  });
});
