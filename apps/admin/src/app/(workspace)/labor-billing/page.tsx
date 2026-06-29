import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { LaborPayBillingWorkspace } from "../../../components/labor-pay-billing-workspace";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  buildLaborPayBillingQuery,
  type LaborPayBillingPreview
} from "../../../lib/labor-pay-billing-utils";
import {
  buildLaborWorkLogQuery,
  EMPTY_LABOR_WORK_WEEK_SUMMARY,
  summarizeLaborWorkByStatus,
  type LaborWorkLogResponse,
  type LaborWorkWeekSummary
} from "../../../lib/labor-work-log-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import { supervisorScopeEmptyMessage } from "../../../lib/supervisor-scope-utils";
import {
  getMondayWeekStart,
  type EmployeeOption,
  type LocationOption,
  type ServiceClientOption
} from "../../../lib/shift-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type LaborBillingPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    weekStart?: string;
    serviceClientId?: string;
    locationId?: string;
    employeeId?: string;
    onlyClosedWeeks?: string;
  }>;
};

function resolveWeekStart(weekStart?: string) {
  if (weekStart && /^\d{4}-\d{2}-\d{2}$/u.test(weekStart)) {
    return weekStart;
  }

  return getMondayWeekStart();
}

export default async function LaborBillingPage({ searchParams }: LaborBillingPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const onlyClosedWeeks = query.onlyClosedWeeks === "true";
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Labor Pay & Billing"
          description="Review approved labor hours for employee pay prep and client labor billing in one place."
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
          title="Labor Pay & Billing"
          description="Review approved labor hours for employee pay prep and client labor billing in one place."
        >
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {emptyScopeMessage}
          </p>
        </AdminShell>
      );
    }

    const [locations, serviceClients] = await Promise.all([
      apiGet<LocationOption[]>(
        `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=false`,
        cookieHeader
      ),
      apiGet<ServiceClientOption[]>(
        `/company-operations/companies/${selectedCompany.id}/service-clients?includeArchived=false`,
        cookieHeader
      )
    ]);

    const weekStart = resolveWeekStart(query.weekStart);
    const thisWeekStart = getMondayWeekStart();

    let employees: EmployeeOption[] = [];
    if (accessContext.canManageCompany) {
      employees = await apiGet<EmployeeOption[]>(
        `/company-operations/companies/${selectedCompany.id}/employees?includeArchived=false`,
        cookieHeader
      );
    }

    const preview = await apiGet<LaborPayBillingPreview>(
      `/company-operations/companies/${selectedCompany.id}/labor-pay-billing/preview${buildLaborPayBillingQuery(
        {
          weekStart,
          ...(query.serviceClientId ? { serviceClientId: query.serviceClientId } : {}),
          ...(query.locationId ? { locationId: query.locationId } : {}),
          ...(query.employeeId ? { employeeId: query.employeeId } : {}),
          ...(onlyClosedWeeks ? { onlyClosedWeeks: true } : {})
        }
      )}`,
      cookieHeader
    );

    let workContextSummary: LaborWorkWeekSummary = EMPTY_LABOR_WORK_WEEK_SUMMARY;
    try {
      const workLog = await apiGet<LaborWorkLogResponse>(
        `/company-operations/companies/${selectedCompany.id}/labor-work-assignments${buildLaborWorkLogQuery(
          {
            from: preview.periodStart,
            to: preview.periodEnd,
            ...(query.serviceClientId ? { serviceClientId: query.serviceClientId } : {}),
            ...(query.locationId ? { locationId: query.locationId } : {})
          }
        )}`,
        cookieHeader
      );
      workContextSummary = summarizeLaborWorkByStatus(workLog.items);
    } catch {
      // Billing remains usable when operational work log is unavailable (e.g. migration pending).
    }

    return (
      <AdminShell
        title="Labor Pay & Billing"
        description="Review approved labor hours for employee pay prep and client labor billing in one place."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {preview.totals.approvedShiftCount} approved shifts
          </span>
        }
      >
        <LaborPayBillingWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          preview={preview}
          workContextSummary={workContextSummary}
          locations={locations}
          serviceClients={serviceClients}
          employees={employees}
          canManageCompany={accessContext.canManageCompany}
          initialWeekStart={weekStart}
          initialServiceClientId={query.serviceClientId ?? ""}
          initialLocationId={query.locationId ?? ""}
          initialEmployeeId={query.employeeId ?? ""}
          initialOnlyClosedWeeks={onlyClosedWeeks}
          thisWeekStart={thisWeekStart}
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
        title="Labor Pay & Billing"
        description="Review approved labor hours for employee pay prep and client labor billing in one place."
      >
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiUnreachable ? (
            <>
              The API at <code className="font-mono">{API_BASE_URL}</code> is not reachable. Start it with{" "}
              <code className="font-mono">pnpm dev</code> from the repo root.
            </>
          ) : error instanceof WorkspaceApiError ? (
            error.message
          ) : (
            <>Unable to load labor pay and billing data right now.</>
          )}
        </p>
      </AdminShell>
    );
  }
}
