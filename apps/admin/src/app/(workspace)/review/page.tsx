import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { ReviewWorkspace } from "../../../components/review-workspace";
import type { ReviewShiftRecord, ReviewStatusFilter } from "../../../lib/review-utils";
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

type ReviewPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    weekStart?: string;
    locationId?: string;
    employeeId?: string;
    status?: ReviewStatusFilter;
    q?: string;
  }>;
};

function resolveWeekStart(weekStart?: string) {
  if (weekStart && /^\d{4}-\d{2}-\d{2}$/u.test(weekStart)) {
    return weekStart;
  }

  return getMondayWeekStart();
}

function resolveStatusFilter(status?: string): ReviewStatusFilter {
  if (
    status === "needs_review" ||
    status === "approved" ||
    status === "incomplete" ||
    status === "exceptions"
  ) {
    return status;
  }

  return "";
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const weekStart = resolveWeekStart(query.weekStart);
    const status = resolveStatusFilter(query.status);
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Review"
          description="Review completed shifts, exceptions, breaks, and internal labor estimates before approval."
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
          title="Review"
          description="Review completed shifts, exceptions, breaks, and internal labor estimates before approval."
        >
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {emptyScopeMessage}
          </p>
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

    const reviewParams = new URLSearchParams({ from, to });
    if (query.locationId) {
      reviewParams.set("locationId", query.locationId);
    }
    if (query.employeeId) {
      reviewParams.set("employeeId", query.employeeId);
    }
    if (status) {
      reviewParams.set("status", status);
    }

    const shifts = await apiGet<ReviewShiftRecord[]>(
      `/company-operations/companies/${selectedCompany.id}/review-shifts?${reviewParams.toString()}`,
      cookieHeader
    );

    return (
      <AdminShell
        title="Review"
        description="Review completed shifts, exceptions, breaks, and internal labor estimates before approval."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {shifts.length} {shifts.length === 1 ? "shift" : "shifts"}
          </span>
        }
      >
        <ReviewWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          shifts={shifts}
          employees={employees}
          locations={locations}
          initialWeekStart={weekStart}
          initialLocationId={query.locationId ?? ""}
          initialEmployeeId={query.employeeId ?? ""}
          initialStatus={status}
          initialQuery={query.q ?? ""}
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
        title="Review"
        description="Review completed shifts, exceptions, breaks, and internal labor estimates before approval."
      >
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiUnreachable ? (
            <>
              The API at <code className="font-mono">{API_BASE_URL}</code> is not reachable. Start it with{" "}
              <code className="font-mono">pnpm dev</code> from the repo root.
            </>
          ) : error instanceof WorkspaceApiError && error.status === 403 ? (
            <>You do not have access to review data for this company or location.</>
          ) : (
            <>Check that the API is running and that your session is valid.</>
          )}
        </p>
      </AdminShell>
    );
  }
}
