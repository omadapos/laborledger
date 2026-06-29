/**
 * Server-side Field company resolution for employee PIN login and worker BFF routes.
 *
 * Local/demo: set WORKER_COMPANY_ID in apps/field/.env.local (from pnpm seed:demo).
 * Production (future slice): resolve from host/subdomain or provisioned Field app context;
 * if unresolved, show an allowed-company selector — never a public list of all tenants.
 *
 * Browser-submitted companyId is never authoritative.
 */

export type FieldCompanyResolution =
  | { status: "resolved"; companyId: string; source: "env" }
  | { status: "unresolved"; source: "none" };

const FIELD_COMPANY_NOT_CONFIGURED_MESSAGE =
  "Sign-in is not available on this device. Ask your supervisor to configure LaborLedger Field.";

export function resolveFieldCompany(): FieldCompanyResolution {
  const companyId = process.env.WORKER_COMPANY_ID?.trim() ?? "";
  if (companyId.length > 0) {
    return { status: "resolved", companyId, source: "env" };
  }

  return { status: "unresolved", source: "none" };
}

export function requireResolvedFieldCompanyId(): string | null {
  const resolution = resolveFieldCompany();
  return resolution.status === "resolved" ? resolution.companyId : null;
}

export function isFieldCompanyConfigured(): boolean {
  return resolveFieldCompany().status === "resolved";
}

export function fieldCompanyNotConfiguredMessage(): string {
  return FIELD_COMPANY_NOT_CONFIGURED_MESSAGE;
}
