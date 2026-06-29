import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { WeeklyCloseWorkspace } from "../../../components/weekly-close-workspace";
import { getMondayWeekStart } from "../../../lib/shift-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import { SUPERVISOR_FORBIDDEN_MESSAGE } from "../../../lib/supervisor-scope-utils";
import type { WeeklyCloseSummary } from "../../../lib/weekly-close-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type WeeklyClosePageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    weekStart?: string;
  }>;
};

function resolveWeekStart(weekStart?: string) {
  if (weekStart && /^\d{4}-\d{2}-\d{2}$/u.test(weekStart)) {
    return weekStart;
  }

  return getMondayWeekStart();
}

export default async function WeeklyClosePage({ searchParams }: WeeklyClosePageProps) {
  try {
    const query = (await searchParams) ?? {};
    const weekStart = resolveWeekStart(query.weekStart);
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Weekly Close"
          description="Review approved time, unresolved exceptions, and internal labor estimates before closing the company week."
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

    if (!accessContext.canAccessWeeklyClose) {
      return (
        <AdminShell
          title="Weekly Close"
          description="Review approved time, unresolved exceptions, and internal labor estimates before closing the company week."
        >
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {SUPERVISOR_FORBIDDEN_MESSAGE}
          </p>
        </AdminShell>
      );
    }

    const summary = await apiGet<WeeklyCloseSummary>(
      `/company-operations/companies/${selectedCompany.id}/weekly-close?weekStart=${weekStart}`,
      cookieHeader
    );

    return (
      <AdminShell
        title="Weekly Close"
        description="Review approved time, unresolved exceptions, and internal labor estimates before closing the company week."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {summary.blockers.length} {summary.blockers.length === 1 ? "blocker" : "blockers"}
          </span>
        }
      >
        <WeeklyCloseWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          summary={summary}
          initialWeekStart={weekStart}
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
        title="Weekly Close"
        description="Review approved time, unresolved exceptions, and internal labor estimates before closing the company week."
      >
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiUnreachable ? (
            <>
              The API at <code>{API_BASE_URL}</code> is not reachable. Check that the API is running and that your
              session is valid.
            </>
          ) : (
            <>Unable to load weekly close data.</>
          )}
        </p>
      </AdminShell>
    );
  }
}
