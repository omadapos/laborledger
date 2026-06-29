import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { CorrectionsWorkspace } from "../../../components/corrections-workspace";
import type { CorrectionSummary, CorrectionStatusFilter, CorrectionTypeFilter } from "../../../lib/correction-utils";
import type { ReviewShiftRecord } from "../../../lib/review-utils";
import {
  getMondayWeekStart,
  resolveWeekFilterTimeZone,
  weekRangeToUtcBounds,
  type EmployeeOption,
  type LocationOption
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

type CorrectionsPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    weekStart?: string;
    locationId?: string;
    employeeId?: string;
    status?: CorrectionStatusFilter;
    type?: CorrectionTypeFilter;
    q?: string;
  }>;
};

function resolveWeekStart(weekStart?: string) {
  if (weekStart && /^\d{4}-\d{2}-\d{2}$/u.test(weekStart)) return weekStart;
  return getMondayWeekStart();
}

export default async function CorrectionsPage({ searchParams }: CorrectionsPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const weekStart = resolveWeekStart(query.weekStart);
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Corrections"
          description="Review requested changes to punch events while preserving original records and audit history."
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
        <AdminShell title="Corrections" description="Review requested changes to punch events while preserving original records and audit history.">
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{emptyScopeMessage}</p>
        </AdminShell>
      );
    }

    const locations = await apiGet<LocationOption[]>(
      `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=false`,
      cookieHeader
    );

    let employees: EmployeeOption[] = [];
    if (accessContext.canManageCompany) {
      employees = await apiGet<EmployeeOption[]>(
        `/company-operations/companies/${selectedCompany.id}/employees?includeArchived=false`,
        cookieHeader
      );
    }

    const filterTimeZone = resolveWeekFilterTimeZone(locations, query.locationId);
    const { from, to } = weekRangeToUtcBounds(weekStart, filterTimeZone);

    const params = new URLSearchParams({ from, to });
    if (query.locationId) params.set("locationId", query.locationId);
    if (query.employeeId) params.set("employeeId", query.employeeId);
    if (query.status) params.set("status", query.status);
    if (query.type) params.set("type", query.type);

    const [corrections, reviewShifts] = await Promise.all([
      apiGet<CorrectionSummary[]>(`/company-operations/companies/${selectedCompany.id}/corrections?${params.toString()}`, cookieHeader),
      apiGet<ReviewShiftRecord[]>(`/company-operations/companies/${selectedCompany.id}/review-shifts?${params.toString()}`, cookieHeader)
    ]);

    const shiftOptions = reviewShifts.map((shift) => ({
      shiftId: shift.shiftId,
      employeeName: shift.employee.fullName,
      locationName: shift.location.name,
      scheduledStartUtc: shift.scheduledStartUtc
    }));

    return (
      <AdminShell
        title="Corrections"
        description="Review requested changes to punch events while preserving original records and audit history."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {corrections.length} {corrections.length === 1 ? "request" : "requests"}
          </span>
        }
      >
        <CorrectionsWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          corrections={corrections}
          shiftOptions={shiftOptions}
          employees={employees}
          locations={locations}
          initialWeekStart={weekStart}
          initialLocationId={query.locationId ?? ""}
          initialEmployeeId={query.employeeId ?? ""}
          initialStatus={query.status ?? ""}
          initialType={query.type ?? ""}
          initialQuery={query.q ?? ""}
          canManageCompany={accessContext.canManageCompany}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) redirect("/login");
    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;
    return (
      <AdminShell title="Corrections" description="Review requested changes to punch events while preserving original records and audit history.">
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiUnreachable ? <>The API at <code>{API_BASE_URL}</code> is not reachable.</> : <>Unable to load corrections data.</>}
        </p>
      </AdminShell>
    );
  }
}
