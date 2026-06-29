import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { ClientInvoicesWorkspace } from "../../../components/client-invoices-workspace";
import {
  buildClientInvoiceListQuery,
  type ClientInvoiceListRecord,
  type ClientInvoiceStatus
} from "../../../lib/client-invoice-utils";
import type { ServiceClientRecord } from "../../../lib/location-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type ClientInvoicesPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    status?: string;
    q?: string;
    serviceClientId?: string;
  }>;
};

function resolveStatusFilter(status?: string): ClientInvoiceStatus | "" {
  if (status === "DRAFT" || status === "ISSUED" || status === "VOID") {
    return status;
  }

  return "";
}

export default async function ClientInvoicesPage({ searchParams }: ClientInvoicesPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Client Invoices"
          description="No accessible companies were returned for this account."
        >
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany, companies } = workspace;

    const listQuery = buildClientInvoiceListQuery({
      ...(query.serviceClientId ? { serviceClientId: query.serviceClientId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(query.q?.trim() ? { q: query.q.trim() } : {})
    });

    const [invoices, serviceClients] = await Promise.all([
      apiGet<ClientInvoiceListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/client-invoices${listQuery}`,
        cookieHeader
      ),
      apiGet<ServiceClientRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/service-clients`,
        cookieHeader
      )
    ]);

    return (
      <AdminShell
        title="Client Invoices"
        description="Create and issue client invoices from completed vehicle service work orders."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
          </span>
        }
      >
        <ClientInvoicesWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          invoices={invoices}
          serviceClients={serviceClients}
          initialQuery={query.q ?? ""}
          initialStatus={statusFilter}
          initialServiceClientId={query.serviceClientId ?? ""}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell
        title="Client Invoices"
        description="Create and issue client invoices from completed vehicle service work orders."
      >
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiUnreachable
            ? "Unable to reach the API. Start the API service and refresh this page."
            : "Unable to load client invoices right now."}
        </div>
      </AdminShell>
    );
  }
}
