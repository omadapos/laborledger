import { AdminShell } from "../../../components/admin-shell";
import { JobsWorkspace } from "../../../components/jobs-workspace";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import { JOBS_PAGE_DESCRIPTION, JOBS_PAGE_TITLE } from "../../../lib/jobs-utils";
import { buildWorkOrderListQuery, type WorkOrderListRecord, type WorkOrderStatus } from "../../../lib/work-order-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import { apiGet, loadWorkspaceContext, WorkspaceApiError } from "../../../lib/workspace-auth";

type JobsPageProps = {
  readonly searchParams?: Promise<{
    status?: string;
    q?: string;
    serviceClientId?: string;
    locationId?: string;
  }>;
};

function resolveStatusFilter(status?: string): WorkOrderStatus | "" {
  if (
    status === "DRAFT" ||
    status === "READY" ||
    status === "ASSIGNED" ||
    status === "IN_PROGRESS" ||
    status === "COMPLETED" ||
    status === "INVOICED" ||
    status === "CANCELLED"
  ) {
    return status;
  }

  return "";
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title={JOBS_PAGE_TITLE} description={JOBS_PAGE_DESCRIPTION}>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, session, selectedCompany } = workspace;

    const listQuery = buildWorkOrderListQuery({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(query.serviceClientId ? { serviceClientId: query.serviceClientId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.q?.trim() ? { q: query.q.trim() } : {})
    });

    const [accessContext, workOrders] = await Promise.all([
      apiGet<CompanyAccessContext>(
        `/company-operations/companies/${selectedCompany.id}/access-context`,
        cookieHeader
      ),
      apiGet<WorkOrderListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/work-orders${listQuery}`,
        cookieHeader
      )
    ]);

    return (
      <AdminShell
        title={JOBS_PAGE_TITLE}
        description={`${JOBS_PAGE_DESCRIPTION} Active company: ${selectedCompany.name}.`}
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            Signed in as {session.user.email}
          </span>
        }
      >
        <JobsWorkspace
          workOrders={workOrders}
          initialQuery={query.q?.trim() ?? ""}
          initialStatus={statusFilter}
          initialServiceClientId={query.serviceClientId ?? ""}
          initialLocationId={query.locationId ?? ""}
          canManageCompany={accessContext.canManageCompany}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 403) {
      return (
        <AdminShell title={JOBS_PAGE_TITLE} description={JOBS_PAGE_DESCRIPTION}>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You do not have access to company jobs for this company.
          </p>
        </AdminShell>
      );
    }

    return (
      <AdminShell title={JOBS_PAGE_TITLE} description={JOBS_PAGE_DESCRIPTION}>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load company jobs right now. Check that the API is running and try again.
        </p>
      </AdminShell>
    );
  }
}
