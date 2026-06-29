import { PlatformShell } from "../../../../../components/platform-shell";
import { PlatformCustomerCompaniesWorkspace } from "../../../../../components/create-platform-company-form";
import {
  platformCustomerCompaniesHelperCopy,
  platformCustomerCompaniesPageDescription,
  type PlatformCustomerCompanyRecord,
  type PlatformCustomerRecord
} from "../../../../../lib/platform-customer-utils";
import { apiGet, WorkspaceApiError } from "../../../../../lib/workspace-auth";
import { loadPlatformSuperadminContext } from "../../../../../lib/platform-auth";

type PlatformCustomerCompaniesPageProps = {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ create?: string }>;
};

export default async function PlatformCustomerCompaniesPage({
  params,
  searchParams
}: PlatformCustomerCompaniesPageProps) {
  const { groupId } = await params;
  const { create } = await searchParams;

  let customer: PlatformCustomerRecord | null = null;
  let companies: PlatformCustomerCompanyRecord[] = [];
  let loadError: string | null = null;

  try {
    const { cookieHeader } = await loadPlatformSuperadminContext();
    customer = await apiGet<PlatformCustomerRecord>(`/platform/customers/${groupId}`, cookieHeader);
    companies = await apiGet<PlatformCustomerCompanyRecord[]>(
      `/platform/customers/${groupId}/companies`,
      cookieHeader
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError) {
      if (error.status === 401) {
        loadError = "Your session expired. Sign in again as platform superadmin.";
      } else if (error.status === 403) {
        loadError = "Platform superadmin access is required to manage customer companies.";
      } else if (error.status === 404) {
        loadError = "Customer account not found.";
      } else {
        loadError = "Unable to load customer companies. Check that the API is running.";
      }
    } else {
      loadError = "Unable to load customer companies. Check that the API is running.";
    }
  }

  return (
    <PlatformShell
      title={customer ? `${customer.name} companies` : "Customer companies"}
      description={
        customer
          ? platformCustomerCompaniesPageDescription(customer.name)
          : "Manage companies under a SaaS customer account."
      }
    >
      <div className="space-y-6">
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {platformCustomerCompaniesHelperCopy()}
        </p>

        {loadError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </p>
        ) : customer ? (
          <PlatformCustomerCompaniesWorkspace
            customer={customer}
            companies={companies}
            defaultCreateOpen={create === "1"}
          />
        ) : null}
      </div>
    </PlatformShell>
  );
}
