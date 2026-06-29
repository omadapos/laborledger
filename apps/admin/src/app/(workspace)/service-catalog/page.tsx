import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { ServiceCatalogWorkspace } from "../../../components/service-catalog-workspace";
import type { ServiceCatalogListRecord } from "../../../lib/service-catalog-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type ServiceCatalogPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    status?: string;
    q?: string;
    category?: string;
  }>;
};

function resolveStatusFilter(status?: string): "active" | "inactive" | "all" {
  if (status === "inactive" || status === "all") {
    return status;
  }

  return "active";
}

export default async function ServiceCatalogPage({ searchParams }: ServiceCatalogPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const includeArchived = statusFilter === "inactive" || statusFilter === "all";
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Service Catalog"
          description="No accessible companies were returned for this account."
        >
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany, companies } = workspace;

    const catalogItems = await apiGet<ServiceCatalogListRecord[]>(
      `/company-operations/companies/${selectedCompany.id}/service-catalog?includeArchived=${includeArchived ? "true" : "false"}`,
      cookieHeader
    );

    const visibleItems =
      statusFilter === "inactive"
        ? catalogItems.filter((item) => item.archivedAt)
        : statusFilter === "active"
          ? catalogItems.filter((item) => !item.archivedAt)
          : catalogItems;

    return (
      <AdminShell
        title="Service Catalog"
        description="Manage configurable vehicle services and fixed prices used for future work orders and client invoices."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {visibleItems.length} {visibleItems.length === 1 ? "service" : "services"}
          </span>
        }
      >
        <ServiceCatalogWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          items={visibleItems}
          initialQuery={query.q ?? ""}
          initialStatus={statusFilter}
          initialCategory={query.category ?? ""}
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
        title="Service Catalog"
        description="Unable to load service catalog from the API."
      >
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiUnreachable ? (
            <>
              The API at <code className="font-mono">{API_BASE_URL}</code> is not reachable. Start it with{" "}
              <code className="font-mono">pnpm dev</code> from the repo root.
            </>
          ) : (
            <>Check that the API is running and that your session is valid.</>
          )}
        </p>
      </AdminShell>
    );
  }
}
