import Link from "next/link";

import { AdminShell } from "../../../components/admin-shell";
import { ReceptionWorkspace } from "../../../components/reception-workspace";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import type { ServiceCatalogListRecord } from "../../../lib/service-catalog-utils";
import type { LocationRecord, ServiceClientRecord } from "../../../lib/location-utils";
import {
  RECEPTION_GO_TO_JOBS_CTA,
  RECEPTION_PAGE_DESCRIPTION,
  RECEPTION_PAGE_TITLE,
  RECEPTION_SUPERVISOR_BLOCKED_LINE_1,
  RECEPTION_SUPERVISOR_BLOCKED_LINE_2,
  canOpenReception,
  jobsRoute
} from "../../../lib/reception-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import { apiGet, loadWorkspaceContext } from "../../../lib/workspace-auth";

export default async function ReceptionPage() {
  try {
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title={RECEPTION_PAGE_TITLE} description={RECEPTION_PAGE_DESCRIPTION}>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, session, selectedCompany } = workspace;

    const accessContext = await apiGet<CompanyAccessContext>(
      `/company-operations/companies/${selectedCompany.id}/access-context`,
      cookieHeader
    );

    if (!accessContext.canManageCompany) {
      return (
        <AdminShell title={RECEPTION_PAGE_TITLE} description={RECEPTION_PAGE_DESCRIPTION}>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p>{RECEPTION_SUPERVISOR_BLOCKED_LINE_1}</p>
            <p className="mt-2">{RECEPTION_SUPERVISOR_BLOCKED_LINE_2}</p>
            <Link
              href={jobsRoute()}
              className="mt-4 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 transition hover:bg-amber-100"
            >
              {RECEPTION_GO_TO_JOBS_CTA}
            </Link>
          </div>
        </AdminShell>
      );
    }

    const [serviceClients, locations, catalogItems] = await Promise.all([
      apiGet<ServiceClientRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/service-clients?includeArchived=false`,
        cookieHeader
      ),
      apiGet<LocationRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=false`,
        cookieHeader
      ),
      apiGet<ServiceCatalogListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/service-catalog?includeArchived=false`,
        cookieHeader
      )
    ]);

    const canReceive = canOpenReception(serviceClients, locations, accessContext.canManageCompany);

    return (
      <AdminShell
        title={RECEPTION_PAGE_TITLE}
        description={`${RECEPTION_PAGE_DESCRIPTION} Active company: ${selectedCompany.name}.`}
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            Signed in as {session.user.email}
          </span>
        }
      >
        {canReceive ? (
          <ReceptionWorkspace
            companyId={selectedCompany.id}
            serviceClients={serviceClients}
            locations={locations}
            catalogItems={catalogItems}
          />
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Add at least one service client, location, and catalog service before receiving vehicles.
          </p>
        )}
      </AdminShell>
    );
  } catch {
    return (
      <AdminShell title={RECEPTION_PAGE_TITLE} description={RECEPTION_PAGE_DESCRIPTION}>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load reception right now. Check that the API is running and try again.
        </p>
      </AdminShell>
    );
  }
}
