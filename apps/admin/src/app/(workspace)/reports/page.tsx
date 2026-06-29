import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { OperationsReportsWorkspace } from "../../../components/operations-reports-workspace";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  buildOperationsReportQuery,
  parseOperationsReportSearchParams,
  type OperationsSummaryReport
} from "../../../lib/operations-reports-utils";
import { SUPERVISOR_FORBIDDEN_MESSAGE } from "../../../lib/supervisor-scope-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import {
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type ReportsPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const range = parseOperationsReportSearchParams(query);
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Reports"
          description="Track vehicle service operations, completed work, and client invoice activity."
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

    if (!accessContext.canManageCompany) {
      return (
        <AdminShell
          title="Reports"
          description="Track vehicle service operations, completed work, and client invoice activity."
        >
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {SUPERVISOR_FORBIDDEN_MESSAGE}
          </p>
        </AdminShell>
      );
    }

    const report = await apiGet<OperationsSummaryReport>(
      `/company-operations/companies/${selectedCompany.id}/reports/operations-summary${buildOperationsReportQuery(range)}`,
      cookieHeader
    );

    return (
      <AdminShell
        title="Reports"
        description="Track vehicle service operations, completed work, and client invoice activity."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {range.from} → {range.to}
          </span>
        }
      >
        <OperationsReportsWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          report={report}
          initialRange={range}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const message =
      error instanceof WorkspaceApiError
        ? error.message
        : "Unable to load operational reports right now.";

    return (
      <AdminShell
        title="Reports"
        description="Track vehicle service operations, completed work, and client invoice activity."
      >
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>
      </AdminShell>
    );
  }
}
