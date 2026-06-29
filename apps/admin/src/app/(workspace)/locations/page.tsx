import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { LocationsWorkspace } from "../../../components/locations-workspace";
import {
  enrichLocations,
  type LocationRecord,
  type ServiceClientRecord
} from "../../../lib/location-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import { supervisorScopeEmptyMessage } from "../../../lib/supervisor-scope-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type LocationsPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    status?: string;
    q?: string;
  }>;
};

function resolveStatusFilter(status?: string): "active" | "inactive" | "all" {
  if (status === "inactive" || status === "all") {
    return status;
  }

  return "active";
}

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const includeArchived = statusFilter === "inactive" || statusFilter === "all";
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Locations"
          description="No accessible companies were returned for this account."
        >
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, session, selectedCompany, companies } = workspace;

    const accessContext = await apiGet<CompanyAccessContext>(
      `/company-operations/companies/${selectedCompany.id}/access-context`,
      cookieHeader
    );

    const emptyScopeMessage = supervisorScopeEmptyMessage(accessContext);
    if (emptyScopeMessage) {
      return (
        <AdminShell title="Locations" description="Locations define where work happens and provide the IANA time zone used for scheduling, punches, and weekly close.">
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{emptyScopeMessage}</p>
        </AdminShell>
      );
    }

    const locations = await apiGet<LocationRecord[]>(
      `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=${includeArchived ? "true" : "false"}`,
      cookieHeader
    );

    let serviceClients: ServiceClientRecord[] = [];
    if (accessContext.canManageCompany) {
      serviceClients = await apiGet<ServiceClientRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/service-clients?includeArchived=true`,
        cookieHeader
      );
    }

    const visibleLocations =
      statusFilter === "inactive"
        ? locations.filter((location) => location.archivedAt)
        : statusFilter === "active"
          ? locations.filter((location) => !location.archivedAt)
          : locations;

    const locationViews = enrichLocations(visibleLocations, serviceClients);

    return (
      <AdminShell
        title="Locations"
        description={`Signed in as ${session.user.email}. Locations define where work happens and provide the IANA time zone used for scheduling, punches, and weekly close at ${selectedCompany.name}.`}
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {locationViews.length} {locationViews.length === 1 ? "location" : "locations"}
          </span>
        }
      >
        <LocationsWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          locations={locationViews}
          serviceClients={serviceClients}
          initialQuery={query.q ?? ""}
          initialStatus={statusFilter}
          canManageCompany={accessContext.canManageCompany}
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
        title="Locations"
        description="Unable to load locations from the API."
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
