import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { VehiclesWorkspace } from "../../../components/vehicles-workspace";
import type { LocationRecord, ServiceClientRecord } from "../../../lib/location-utils";
import {
  buildVehicleListQuery,
  type VehicleListRecord
} from "../../../lib/vehicle-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type VehiclesPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    status?: string;
    q?: string;
    serviceClientId?: string;
    locationId?: string;
  }>;
};

function resolveStatusFilter(status?: string): "active" | "inactive" | "all" {
  if (status === "inactive" || status === "all") {
    return status;
  }

  return "active";
}

export default async function VehiclesPage({ searchParams }: VehiclesPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const includeArchived = statusFilter === "inactive" || statusFilter === "all";
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Vehicles"
          description="No accessible companies were returned for this account."
        >
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany, companies } = workspace;

    const listQuery = buildVehicleListQuery({
      includeArchived,
      ...(query.serviceClientId ? { serviceClientId: query.serviceClientId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.q?.trim() ? { q: query.q.trim() } : {})
    });

    const [vehicles, serviceClients, locations] = await Promise.all([
      apiGet<VehicleListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/vehicles${listQuery}`,
        cookieHeader
      ),
      apiGet<ServiceClientRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/service-clients?includeArchived=true`,
        cookieHeader
      ),
      apiGet<LocationRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=true`,
        cookieHeader
      )
    ]);

    const visibleVehicles =
      statusFilter === "inactive"
        ? vehicles.filter((vehicle) => vehicle.archivedAt)
        : statusFilter === "active"
          ? vehicles.filter((vehicle) => !vehicle.archivedAt)
          : vehicles;

    return (
      <AdminShell
        title="Vehicles"
        description="Manage VIN-backed vehicles received for future service work orders."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {visibleVehicles.length} {visibleVehicles.length === 1 ? "vehicle" : "vehicles"}
          </span>
        }
      >
        <VehiclesWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          vehicles={visibleVehicles}
          serviceClients={serviceClients}
          locations={locations}
          initialQuery={query.q ?? ""}
          initialStatus={statusFilter}
          initialServiceClientId={query.serviceClientId ?? ""}
          initialLocationId={query.locationId ?? ""}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell title="Vehicles" description="Unable to load vehicles from the API.">
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
