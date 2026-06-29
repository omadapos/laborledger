import { PlatformShell } from "../../../../components/platform-shell";
import { CreatePlatformCustomerForm } from "../../../../components/create-platform-customer-form";
import { PlatformCustomersTable } from "../../../../components/platform-customers-table";
import {
  platformCustomersHelperCopy,
  platformCustomersPageDescription,
  type PlatformCustomerRecord
} from "../../../../lib/platform-customer-utils";
import { apiGet, WorkspaceApiError } from "../../../../lib/workspace-auth";
import { loadPlatformSuperadminContext } from "../../../../lib/platform-auth";

export default async function PlatformCustomersPage() {
  let customers: PlatformCustomerRecord[] = [];
  let loadError: string | null = null;

  try {
    const { cookieHeader } = await loadPlatformSuperadminContext();
    customers = await apiGet<PlatformCustomerRecord[]>("/platform/customers", cookieHeader);
  } catch (error) {
    if (error instanceof WorkspaceApiError) {
      if (error.status === 401) {
        loadError = "Your session expired. Sign in again as platform superadmin.";
      } else if (error.status === 403) {
        loadError = "Platform superadmin access is required to view customer accounts.";
      } else {
        loadError = "Unable to load customer accounts. Check that the API is running.";
      }
    } else {
      loadError = "Unable to load customer accounts. Check that the API is running.";
    }
  }

  return (
    <PlatformShell title="Customers" description={platformCustomersPageDescription()}>
      <div className="space-y-6">
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {platformCustomersHelperCopy()}
        </p>

        <CreatePlatformCustomerForm />

        {loadError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </p>
        ) : customers.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No SaaS customer accounts yet. Create the first customer to provision a group, company, and
            owner login.
          </p>
        ) : (
          <PlatformCustomersTable customers={customers} />
        )}
      </div>
    </PlatformShell>
  );
}
