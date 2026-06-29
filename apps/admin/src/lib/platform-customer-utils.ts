export type PlatformCustomerLifecycleStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type PlatformCustomerOwnerStatus = "Active" | "Invited" | "Pending";

export type PlatformCustomerRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  companyCount: number;
  primaryCompany: {
    id: string;
    name: string;
  } | null;
  owner: {
    email: string;
    fullName: string | null;
  } | null;
  lifecycleStatus: PlatformCustomerLifecycleStatus;
  ownerStatus: PlatformCustomerOwnerStatus;
  suspendedAt: string | null;
  suspendedReason: string | null;
  archivedAt: string | null;
  archivedReason: string | null;
};

export type CreatePlatformCustomerResponse = {
  customer: {
    id: string;
    name: string;
    createdAt: string;
  };
  company: {
    id: string;
    name: string;
    groupId: string;
  };
  owner: {
    id: string;
    email: string;
    fullName: string | null;
  };
  temporaryPassword: string;
};

export const PLATFORM_LIFECYCLE_SUSPEND_WARNING =
  "Suspending blocks tenant access but does not delete data.";

export const PLATFORM_LIFECYCLE_ARCHIVE_WARNING =
  "Archiving blocks access and keeps historical data. Archived customers cannot be reactivated in V1.";

export const ACCOUNT_SUSPENDED_TENANT_COPY =
  "This account is suspended. Contact your LaborLedger administrator.";

export const ACCOUNT_ARCHIVED_TENANT_COPY =
  "This account is archived and cannot be accessed.";

export function isPlatformSuperadmin(globalRole: string): boolean {
  return globalRole === "PLATFORM_SUPERADMIN";
}

export function platformCustomersPageDescription(): string {
  return "Create and manage SaaS customer accounts that use LaborLedger.";
}

export function platformCustomersHelperCopy(): string {
  return "These are LaborLedger customers/accounts, not service clients like Hertz.";
}

export function temporaryPasswordWarningCopy(): string {
  return "Copy this temporary password now. It will not be shown again.";
}

export function formatPlatformCustomerLifecycleStatus(
  status: PlatformCustomerLifecycleStatus
): string {
  if (status === "SUSPENDED") {
    return "Suspended";
  }

  if (status === "ARCHIVED") {
    return "Archived";
  }

  return "Active";
}

export function lifecycleStatusClassName(status: PlatformCustomerLifecycleStatus): string {
  if (status === "SUSPENDED") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (status === "ARCHIVED") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export function formatPlatformCustomerOwnerStatus(status: PlatformCustomerOwnerStatus): string {
  if (status === "Active") {
    return "Active owner";
  }

  if (status === "Invited") {
    return "Invited owner";
  }

  return "Pending owner";
}

export function availableLifecycleActions(status: PlatformCustomerLifecycleStatus) {
  return {
    canSuspend: status === "ACTIVE",
    canReactivate: status === "SUSPENDED",
    canArchive: status === "ACTIVE" || status === "SUSPENDED"
  };
}

export function validateLifecycleReason(
  action: "suspend" | "archive",
  reason: string
): string | null {
  if (!reason.trim()) {
    return action === "suspend" ? "Suspension reason is required." : "Archive reason is required.";
  }

  return null;
}

export function filterPlatformCustomers(
  customers: PlatformCustomerRecord[],
  includeArchived: boolean
): PlatformCustomerRecord[] {
  if (includeArchived) {
    return customers;
  }

  return customers.filter((customer) => customer.lifecycleStatus !== "ARCHIVED");
}

export function formatPlatformCustomerOwnerLabel(
  owner: PlatformCustomerRecord["owner"]
): string {
  if (!owner) {
    return "No owner assigned";
  }

  if (owner.fullName) {
    return `${owner.fullName} · ${owner.email}`;
  }

  return owner.email;
}

export function formatPlatformCustomerPrimaryCompany(customer: PlatformCustomerRecord): string {
  if (!customer.primaryCompany) {
    return "No company yet";
  }

  return customer.primaryCompany.name;
}

export function buildSuspendCustomerPath(groupId: string): string {
  return `/api/platform/customers/${encodeURIComponent(groupId)}/suspend`;
}

export function buildReactivateCustomerPath(groupId: string): string {
  return `/api/platform/customers/${encodeURIComponent(groupId)}/reactivate`;
}

export function buildArchiveCustomerPath(groupId: string): string {
  return `/api/platform/customers/${encodeURIComponent(groupId)}/archive`;
}

export function buildCustomerCompaniesPath(groupId: string): string {
  return `/platform/customers/${encodeURIComponent(groupId)}`;
}

export function buildCreateCustomerCompanyApiPath(groupId: string): string {
  return `/api/platform/customers/${encodeURIComponent(groupId)}/companies`;
}

export function buildListCustomerCompaniesApiPath(groupId: string): string {
  return `/api/platform/customers/${encodeURIComponent(groupId)}/companies`;
}

export type PlatformCustomerCompanyRecord = {
  id: string;
  name: string;
  groupId: string;
  createdAt: string;
  lifecycleStatus: PlatformCustomerLifecycleStatus;
  initialAdmin: {
    email: string;
    fullName: string | null;
    status: PlatformCustomerOwnerStatus;
  } | null;
};

export type CreatePlatformCompanyResponse = {
  company: {
    id: string;
    name: string;
    groupId: string;
  };
  invitationToken: string;
  expiresAt: string;
};

export function platformCustomerCompaniesPageDescription(customerName: string): string {
  return `Companies under customer account ${customerName}. These are operational companies, not service clients.`;
}

export function platformCustomerCompaniesHelperCopy(): string {
  return "Customer Account = SaaS tenant. Company = operational workspace inside that account. Service Client = dealer/customer inside a company.";
}

export function formatPlatformCompanyAdminLabel(
  admin: PlatformCustomerCompanyRecord["initialAdmin"]
): string {
  if (!admin) {
    return "No initial admin assigned";
  }

  if (admin.fullName) {
    return `${admin.fullName} · ${admin.email}`;
  }

  return admin.email;
}

export function formatPlatformCompanyAdminStatus(
  status: PlatformCustomerOwnerStatus
): string {
  if (status === "Active") {
    return "Active admin";
  }

  if (status === "Invited") {
    return "Invited admin";
  }

  return "Pending admin";
}

export function validateCreatePlatformCompanyInput(input: {
  companyName: string;
  adminFullName: string;
  adminEmail: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

  if (!input.companyName.trim()) {
    errors.companyName = "Company name is required.";
  }

  if (!input.adminFullName.trim()) {
    errors.adminFullName = "Initial company admin name is required.";
  }

  if (!input.adminEmail.trim()) {
    errors.adminEmail = "Initial company admin email is required.";
  } else if (!emailPattern.test(input.adminEmail.trim())) {
    errors.adminEmail = "Enter a valid email address.";
  }

  return errors;
}

export function validateCreatePlatformCustomerInput(input: {
  customerName: string;
  companyName: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
  confirmPassword: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

  if (!input.customerName.trim()) {
    errors.customerName = "Customer name is required.";
  }

  if (!input.companyName.trim()) {
    errors.companyName = "Initial company name is required.";
  }

  if (!input.ownerFullName.trim()) {
    errors.ownerFullName = "Owner name is required.";
  }

  if (!input.ownerEmail.trim()) {
    errors.ownerEmail = "Owner email is required.";
  } else if (!emailPattern.test(input.ownerEmail.trim())) {
    errors.ownerEmail = "Enter a valid email address.";
  }

  if (!input.ownerPassword) {
    errors.ownerPassword = "Temporary password is required.";
  } else if (input.ownerPassword.length < 8) {
    errors.ownerPassword = "Temporary password must be at least 8 characters.";
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = "Confirm the temporary password.";
  } else if (input.confirmPassword !== input.ownerPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let password = "Sh";

  for (let index = 0; index < 10; index += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return password;
}
