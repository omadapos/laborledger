import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { EmployeesWorkspace } from "../../../components/employees-workspace";
import type { EmployeeRecord } from "../../../lib/employee-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type EmployeesPageProps = {
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

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const includeArchived = statusFilter === "inactive" || statusFilter === "all";
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Employees"
          description="No accessible companies were returned for this account."
        >
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, session, selectedCompany, companies } = workspace;

    const employees = await apiGet<EmployeeRecord[]>(
      `/company-operations/companies/${selectedCompany.id}/employees?includeArchived=${includeArchived ? "true" : "false"}`,
      cookieHeader
    );

    const visibleEmployees =
      statusFilter === "inactive"
        ? employees.filter((employee) => employee.archivedAt)
        : statusFilter === "active"
          ? employees.filter((employee) => !employee.archivedAt)
          : employees;

    return (
      <AdminShell
        title="Employees"
        description={`Signed in as ${session.user.email}. Manage kiosk access, pay rates, and status for ${selectedCompany.name}.`}
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {visibleEmployees.length} {visibleEmployees.length === 1 ? "employee" : "employees"}
          </span>
        }
      >
        <EmployeesWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          employees={visibleEmployees}
          initialQuery={query.q ?? ""}
          initialStatus={statusFilter}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell title="Employees" description="Unable to load employees from the API.">
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiUnreachable ? (
            <>
              The API at <code className="font-mono">{API_BASE_URL}</code> is not reachable. Start it with{" "}
              <code className="font-mono">pnpm dev</code> from the repo root, or run{" "}
              <code className="font-mono">pnpm --filter @laborledger/api dev</code> in a separate terminal.
            </>
          ) : (
            <>Check that the API is running and that your session is valid.</>
          )}
        </p>
      </AdminShell>
    );
  }
}
