export type CompanyAccessRole =
  | "PLATFORM_SUPERADMIN"
  | "GROUP_OWNER"
  | "COMPANY_ADMIN"
  | "SUPERVISOR";

export type AccessibleCompanyRecord = {
  id: string;
  groupId: string;
  name: string;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
  accessRole: CompanyAccessRole;
  accessLabel: string;
};

export type AuthMeResponse = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    globalRole: string;
  };
  activeCompany: AccessibleCompanyRecord | null;
  accessibleCompanies: AccessibleCompanyRecord[];
  requiresCompanySelection: boolean;
};

export type AuthLoginResponse = {
  user: AuthMeResponse["user"];
  accessibleCompanyCount: number;
  activeCompanyId: string | null;
  redirectTo: "dashboard" | "choose-company" | "blocked";
};

export function formatCompanyAccessLabel(role: CompanyAccessRole): string {
  if (role === "PLATFORM_SUPERADMIN") {
    return "Platform superadmin";
  }

  if (role === "GROUP_OWNER") {
    return "Group owner";
  }

  if (role === "COMPANY_ADMIN") {
    return "Company admin";
  }

  return "Supervisor";
}

export function formatActiveCompanyLabel(
  activeCompany: AccessibleCompanyRecord | null | undefined
): string {
  if (!activeCompany) {
    return "No company selected";
  }

  return `${activeCompany.name} · ${activeCompany.accessLabel}`;
}

export function formatChooseCompanyBlockedCopy(reason?: "suspended" | "archived" | "none"): string {
  if (reason === "suspended") {
    return "This account is suspended. Contact your LaborLedger administrator.";
  }

  if (reason === "archived") {
    return "This account is archived and cannot be accessed.";
  }

  return "Your account is signed in, but no company workspace is assigned yet. Ask a platform or group administrator to grant company access.";
}

export function resolveLoginRedirectPath(redirectTo: AuthLoginResponse["redirectTo"]): string {
  if (redirectTo === "choose-company" || redirectTo === "blocked") {
    return redirectTo === "blocked" ? "/choose-company?blocked=1" : "/choose-company";
  }

  return "/employees";
}
