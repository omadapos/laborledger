import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { SchedulingWorkspace } from "../../../components/scheduling-workspace";
import {
  getMondayWeekStart,
  resolveWeekFilterTimeZone,
  weekRangeToUtcBounds,
  type EmployeeOption,
  type LocationOption,
  type ServiceClientOption,
  type ShiftListRecord
} from "../../../lib/shift-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import { supervisorScopeEmptyMessage } from "../../../lib/supervisor-scope-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type SchedulingPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    weekStart?: string;
    locationId?: string;
    employeeId?: string;
    q?: string;
    includeCancelled?: string;
  }>;
};

function resolveWeekStart(weekStart?: string) {
  if (weekStart && /^\d{4}-\d{2}-\d{2}$/u.test(weekStart)) {
    return weekStart;
  }

  return getMondayWeekStart();
}

export default async function SchedulingPage({ searchParams }: SchedulingPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const weekStart = resolveWeekStart(query.weekStart);
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Scheduling"
          description="No accessible companies were returned for this account."
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
        <AdminShell title="Scheduling" description="Create and review scheduled shifts by company, employee, service client, location, and location time zone.">
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{emptyScopeMessage}</p>
        </AdminShell>
      );
    }

    const locations = await apiGet<LocationOption[]>(
      `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=false`,
      cookieHeader
    );

    let employees: EmployeeOption[] = [];
    let serviceClients: ServiceClientOption[] = [];
    if (accessContext.canManageCompany) {
      [employees, serviceClients] = await Promise.all([
        apiGet<EmployeeOption[]>(
          `/company-operations/companies/${selectedCompany.id}/employees?includeArchived=false`,
          cookieHeader
        ),
        apiGet<ServiceClientOption[]>(
          `/company-operations/companies/${selectedCompany.id}/service-clients?includeArchived=false`,
          cookieHeader
        )
      ]);
    }

    const filterTimeZone = resolveWeekFilterTimeZone(locations, query.locationId);
    const { from, to } = weekRangeToUtcBounds(weekStart, filterTimeZone);

    const shiftParams = new URLSearchParams({ from, to });
    if (query.locationId) {
      shiftParams.set("locationId", query.locationId);
    }
    if (query.employeeId) {
      shiftParams.set("employeeId", query.employeeId);
    }
    if (query.includeCancelled === "true") {
      shiftParams.set("includeCancelled", "true");
    }

    const shifts = await apiGet<ShiftListRecord[]>(
      `/company-operations/companies/${selectedCompany.id}/shifts?${shiftParams.toString()}`,
      cookieHeader
    );

    return (
      <AdminShell
        title="Scheduling"
        description="Create and review scheduled shifts by company, employee, service client, location, and location time zone."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {shifts.length} {shifts.length === 1 ? "shift" : "shifts"}
          </span>
        }
      >
        <SchedulingWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          shifts={shifts}
          employees={employees}
          serviceClients={serviceClients}
          locations={locations}
          initialWeekStart={weekStart}
          initialLocationId={query.locationId ?? ""}
          initialEmployeeId={query.employeeId ?? ""}
          initialQuery={query.q ?? ""}
          canManageCompany={accessContext.canManageCompany}
          initialIncludeCancelled={query.includeCancelled === "true"}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell title="Scheduling" description="Unable to load scheduling data from the API.">
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
