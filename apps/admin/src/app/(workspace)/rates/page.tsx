import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { RatesWorkspace } from "../../../components/rates-workspace";
import type { EmployeeRecord } from "../../../lib/employee-utils";
import type { LocationRecord } from "../../../lib/location-utils";
import type { ServiceClientListRecord } from "../../../lib/service-client-utils";
import {
  buildClientLaborRateViews,
  buildEmployeeRateViews,
  buildLocationLaborRateViews,
  type EffectiveRateRecord
} from "../../../lib/rate-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type RatesPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
  }>;
};

async function fetchRatesForEntities(
  cookieHeader: string,
  entityIds: string[],
  pathBuilder: (entityId: string) => string
) {
  const entries = await Promise.all(
    entityIds.map(async (entityId) => {
      const rates = await apiGet<EffectiveRateRecord[]>(pathBuilder(entityId), cookieHeader);
      return [entityId, rates] as const;
    })
  );

  return new Map(entries);
}

export default async function RatesPage(_props: RatesPageProps) {
  try {
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Rates"
          description="No accessible companies were returned for this account."
        >
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, session, selectedCompany, companies } = workspace;

    const [employees, serviceClients, locations] = await Promise.all([
      apiGet<EmployeeRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/employees?includeArchived=false`,
        cookieHeader
      ),
      apiGet<ServiceClientListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/service-clients?includeArchived=false`,
        cookieHeader
      ),
      apiGet<LocationRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=false`,
        cookieHeader
      )
    ]);

    const [employeeRatesById, clientRatesById, locationRatesById] = await Promise.all([
      fetchRatesForEntities(
        cookieHeader,
        employees.map((employee) => employee.id),
        (employeeId) => `/company-operations/employees/${employeeId}/rates`
      ),
      fetchRatesForEntities(
        cookieHeader,
        serviceClients.map((client) => client.id),
        (serviceClientId) => `/company-operations/service-clients/${serviceClientId}/rates`
      ),
      fetchRatesForEntities(
        cookieHeader,
        locations.map((location) => location.id),
        (locationId) => `/company-operations/locations/${locationId}/rates`
      )
    ]);

    const employeeRates = buildEmployeeRateViews(employees, employeeRatesById);
    const clientLaborRates = buildClientLaborRateViews(serviceClients, clientRatesById);
    const locationLaborRates = buildLocationLaborRateViews(locations, locationRatesById);

    const totalRateRows = employeeRates.length + clientLaborRates.length + locationLaborRates.length;

    return (
      <AdminShell
        title="Rates"
        description={`Signed in as ${session.user.email}. Review internal labor rates used for gross-pay and client labor estimate calculations at ${selectedCompany.name}.`}
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {totalRateRows} effective {totalRateRows === 1 ? "rate" : "rates"}
          </span>
        }
      >
        <RatesWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          employeeRates={employeeRates}
          clientLaborRates={clientLaborRates}
          locationLaborRates={locationLaborRates}
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
        title="Rates"
        description="Unable to load rates from the API."
      >
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
