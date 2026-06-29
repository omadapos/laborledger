import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { KiosksWorkspace } from "../../../components/kiosks-workspace";
import type { KioskRecord, LocationOption } from "../../../lib/kiosk-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import { SUPERVISOR_FORBIDDEN_MESSAGE, supervisorScopeEmptyMessage } from "../../../lib/supervisor-scope-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type KiosksPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    status?: string;
    locationId?: string;
    q?: string;
  }>;
};

function resolveStatusFilter(status?: string): "active" | "inactive" | "all" {
  if (status === "inactive" || status === "all") {
    return status;
  }

  return "active";
}

export default async function KiosksPage({ searchParams }: KiosksPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const includeArchived = statusFilter === "inactive" || statusFilter === "all";
    const locationFilter = query.locationId?.trim() ?? "";
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Kiosks"
          description="No accessible companies were returned for this account."
        >
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, session, selectedCompany, companies } = workspace;

    const accessContext = await apiGet<CompanyAccessContext>(
      `/company-operations/companies/${selectedCompany.id}/access-context`,
      cookieHeader
    );

    if (!accessContext.canAccessKioskAdmin) {
      return (
        <AdminShell
          title="Kiosks"
          description="Manage location-bound kiosk devices and pairing credentials used for employee punch actions."
        >
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {SUPERVISOR_FORBIDDEN_MESSAGE}
          </p>
        </AdminShell>
      );
    }

    const emptyScopeMessage = supervisorScopeEmptyMessage(accessContext);
    if (emptyScopeMessage) {
      return (
        <AdminShell
          title="Kiosks"
          description="Manage location-bound kiosk devices and pairing credentials used for employee punch actions."
        >
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{emptyScopeMessage}</p>
        </AdminShell>
      );
    }

    const locationQuery = locationFilter ? `&locationId=${encodeURIComponent(locationFilter)}` : "";

    const [kiosks, locations] = await Promise.all([
      apiGet<KioskRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/kiosks?includeArchived=${includeArchived ? "true" : "false"}${locationQuery}`,
        cookieHeader
      ),
      apiGet<LocationOption[]>(
        `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=true`,
        cookieHeader
      )
    ]);

    const visibleKiosks =
      statusFilter === "inactive"
        ? kiosks.filter((kiosk) => kiosk.archivedAt)
        : statusFilter === "active"
          ? kiosks.filter((kiosk) => !kiosk.archivedAt)
          : kiosks;

    return (
      <AdminShell
        title="Kiosks"
        description="Manage location-bound kiosk devices and pairing credentials used for employee punch actions."
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {visibleKiosks.length} {visibleKiosks.length === 1 ? "kiosk" : "kiosks"}
          </span>
        }
      >
        <p className="mb-4 text-sm text-slate-600">
          Signed in as {session.user.email} at {selectedCompany.name}.
        </p>
        <KiosksWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          kiosks={visibleKiosks}
          locations={locations}
          apiUrl={API_BASE_URL}
          initialQuery={query.q ?? ""}
          initialStatus={statusFilter}
          initialLocationId={locationFilter}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell title="Kiosks" description="Unable to load kiosks from the API.">
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
