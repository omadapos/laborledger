import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { LaborWorkLogWorkspace } from "../../../components/labor-work-log-workspace";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import type { LaborWorkLogResponse } from "../../../lib/labor-work-log-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import { supervisorScopeEmptyMessage } from "../../../lib/supervisor-scope-utils";
import {
  type EmployeeOption,
  type LocationOption,
  type ServiceClientOption
} from "../../../lib/shift-utils";
import { apiGet, loadWorkspaceContext, WorkspaceApiError } from "../../../lib/workspace-auth";

type LaborWorkPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    locationId?: string;
    serviceClientId?: string;
    employeeId?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function LaborWorkPage({ searchParams }: LaborWorkPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Labor Work Log"
          description="Review operational work assignments linked to approved clock/punch hours."
        >
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany, companies } = workspace;

    const accessContext = await apiGet<CompanyAccessContext>(
      `/company-operations/companies/${selectedCompany.id}/access-context`,
      cookieHeader
    );

    const emptyScopeMessage = supervisorScopeEmptyMessage(accessContext);
    if (emptyScopeMessage) {
      return (
        <AdminShell
          title="Labor Work Log"
          description="Review operational work assignments linked to approved clock/punch hours."
        >
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {emptyScopeMessage}
          </p>
        </AdminShell>
      );
    }

    const queryString = new URLSearchParams();
    if (query.locationId) queryString.set("locationId", query.locationId);
    if (query.serviceClientId) queryString.set("serviceClientId", query.serviceClientId);
    if (query.employeeId) queryString.set("employeeId", query.employeeId);
    if (query.status) queryString.set("status", query.status);
    if (query.from) queryString.set("from", query.from);
    if (query.to) queryString.set("to", query.to);

    const [locations, serviceClients, log] = await Promise.all([
      apiGet<LocationOption[]>(
        `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=false`,
        cookieHeader
      ),
      apiGet<ServiceClientOption[]>(
        `/company-operations/companies/${selectedCompany.id}/service-clients?includeArchived=false`,
        cookieHeader
      ),
      apiGet<LaborWorkLogResponse>(
        `/company-operations/companies/${selectedCompany.id}/labor-work-assignments${queryString.toString() ? `?${queryString.toString()}` : ""}`,
        cookieHeader
      )
    ]);

    let employees: EmployeeOption[] = [];
    if (accessContext.canManageCompany) {
      employees = await apiGet<EmployeeOption[]>(
        `/company-operations/companies/${selectedCompany.id}/employees?includeArchived=false`,
        cookieHeader
      );
    }

    return (
      <AdminShell
        title="Labor Work Log"
        description="Review operational work assignments linked to approved clock/punch hours."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {log.items.length} assignments
          </span>
        }
      >
        <LaborWorkLogWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          items={log.items}
          locations={locations}
          serviceClients={serviceClients}
          employees={employees}
          canManageCompany={accessContext.canManageCompany}
          initialLocationId={query.locationId ?? ""}
          initialServiceClientId={query.serviceClientId ?? ""}
          initialEmployeeId={query.employeeId ?? ""}
          initialStatus={query.status ?? ""}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    return (
      <AdminShell
        title="Labor Work Log"
        description="Review operational work assignments linked to approved clock/punch hours."
      >
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof WorkspaceApiError
            ? error.message
            : "Unable to load labor work log right now."}
        </p>
      </AdminShell>
    );
  }
}
