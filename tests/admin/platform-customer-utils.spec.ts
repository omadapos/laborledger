import { describe, expect, it } from "vitest";

import {
  ACCOUNT_ARCHIVED_TENANT_COPY,
  ACCOUNT_SUSPENDED_TENANT_COPY,
  availableLifecycleActions,
  filterPlatformCustomers,
  formatPlatformCustomerLifecycleStatus,
  formatPlatformCustomerOwnerLabel,
  formatPlatformCustomerOwnerStatus,
  formatPlatformCustomerPrimaryCompany,
  isPlatformSuperadmin,
  lifecycleStatusClassName,
  platformCustomersHelperCopy,
  temporaryPasswordWarningCopy,
  validateCreatePlatformCustomerInput,
  validateLifecycleReason
} from "../../apps/admin/src/lib/platform-customer-utils";

describe("platform-customer-utils", () => {
  it("detects platform superadmin role", () => {
    expect(isPlatformSuperadmin("PLATFORM_SUPERADMIN")).toBe(true);
    expect(isPlatformSuperadmin("NONE")).toBe(false);
  });

  it("formats customer helper and password warning copy", () => {
    expect(platformCustomersHelperCopy()).toContain("not service clients");
    expect(temporaryPasswordWarningCopy()).toContain("will not be shown again");
  });

  it("formats customer list labels and lifecycle badges", () => {
    const customer = {
      id: "g1",
      name: "Acme Fleet",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      companyCount: 1,
      primaryCompany: { id: "c1", name: "Acme Main Shop" },
      owner: { email: "owner@example.com", fullName: "Acme Owner" },
      lifecycleStatus: "SUSPENDED" as const,
      ownerStatus: "Active" as const,
      suspendedAt: "2026-01-02T00:00:00.000Z",
      suspendedReason: "Review",
      archivedAt: null,
      archivedReason: null
    };

    expect(formatPlatformCustomerPrimaryCompany(customer)).toBe("Acme Main Shop");
    expect(formatPlatformCustomerOwnerLabel(customer.owner)).toBe("Acme Owner · owner@example.com");
    expect(formatPlatformCustomerOwnerStatus("Invited")).toBe("Invited owner");
    expect(formatPlatformCustomerLifecycleStatus("ARCHIVED")).toBe("Archived");
    expect(lifecycleStatusClassName("ACTIVE")).toContain("emerald");
  });

  it("validates lifecycle reasons and available actions", () => {
    expect(validateLifecycleReason("suspend", "")).toContain("required");
    expect(validateLifecycleReason("archive", "Done")).toBeNull();
    expect(availableLifecycleActions("ACTIVE")).toEqual({
      canSuspend: true,
      canReactivate: false,
      canArchive: true
    });
    expect(availableLifecycleActions("ARCHIVED")).toEqual({
      canSuspend: false,
      canReactivate: false,
      canArchive: false
    });
  });

  it("filters archived customers from default list", () => {
    const customers = [
      {
        id: "1",
        name: "Active",
        lifecycleStatus: "ACTIVE" as const
      },
      {
        id: "2",
        name: "Archived",
        lifecycleStatus: "ARCHIVED" as const
      }
    ];

    expect(filterPlatformCustomers(customers as never, false)).toHaveLength(1);
    expect(filterPlatformCustomers(customers as never, true)).toHaveLength(2);
  });

  it("includes tenant blocked copy for suspended and archived accounts", () => {
    expect(ACCOUNT_SUSPENDED_TENANT_COPY.toLowerCase()).toContain("suspended");
    expect(ACCOUNT_ARCHIVED_TENANT_COPY.toLowerCase()).toContain("archived");
  });

  it("validates create customer form input", () => {
    const errors = validateCreatePlatformCustomerInput({
      customerName: "",
      companyName: "Acme Main",
      ownerFullName: "Owner",
      ownerEmail: "invalid",
      ownerPassword: "short",
      confirmPassword: "other"
    });

    expect(errors.customerName).toBeTruthy();
    expect(errors.ownerEmail).toBeTruthy();
    expect(errors.ownerPassword).toBeTruthy();
    expect(errors.confirmPassword).toBeTruthy();
  });
});
