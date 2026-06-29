"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { CompanyRecord } from "../lib/employee-utils";
import {
  buildLaborWorkLogQuery,
  formatLaborWorkDuration,
  LABOR_WORK_LOG_DISCLAIMER,
  type LaborWorkLogItem
} from "../lib/labor-work-log-utils";
import type { EmployeeOption, LocationOption, ServiceClientOption } from "../lib/shift-utils";

type LaborWorkLogWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly items: LaborWorkLogItem[];
  readonly locations: LocationOption[];
  readonly serviceClients: ServiceClientOption[];
  readonly employees: EmployeeOption[];
  readonly canManageCompany: boolean;
  readonly initialLocationId: string;
  readonly initialServiceClientId: string;
  readonly initialEmployeeId: string;
  readonly initialStatus: string;
};

export function LaborWorkLogWorkspace({
  companies,
  selectedCompany,
  items,
  locations,
  serviceClients,
  employees,
  canManageCompany,
  initialLocationId,
  initialServiceClientId,
  initialEmployeeId,
  initialStatus
}: LaborWorkLogWorkspaceProps) {
  const router = useRouter();

  function buildHref(overrides: {
    companyId?: string;
    locationId?: string;
    serviceClientId?: string;
    employeeId?: string;
    status?: string;
  }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);
    const locationId = overrides.locationId ?? initialLocationId;
    if (locationId) params.set("locationId", locationId);
    const serviceClientId = overrides.serviceClientId ?? initialServiceClientId;
    if (serviceClientId) params.set("serviceClientId", serviceClientId);
    const employeeId = overrides.employeeId ?? initialEmployeeId;
    if (employeeId) params.set("employeeId", employeeId);
    const status = overrides.status ?? initialStatus;
    if (status) params.set("status", status);
    return `/labor-work?${params.toString()}`;
  }

  const exportHref = `/api/company-operations/companies/${selectedCompany.id}/labor-work-assignments/export-csv${buildLaborWorkLogQuery(
    {
      ...(initialLocationId ? { locationId: initialLocationId } : {}),
      ...(initialServiceClientId ? { serviceClientId: initialServiceClientId } : {}),
      ...(initialEmployeeId ? { employeeId: initialEmployeeId } : {}),
      ...(initialStatus ? { status: initialStatus } : {})
    }
  )}`;

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {LABOR_WORK_LOG_DISCLAIMER}
      </p>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Company</span>
          <select
            value={selectedCompany.id}
            onChange={(event) => router.push(buildHref({ companyId: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Location</span>
          <select
            value={initialLocationId}
            onChange={(event) => router.push(buildHref({ locationId: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Client</span>
          <select
            value={initialServiceClientId}
            onChange={(event) => router.push(buildHref({ serviceClientId: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">All clients</option>
            {serviceClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        {canManageCompany ? (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Employee</span>
            <select
              value={initialEmployeeId}
              onChange={(event) => router.push(buildHref({ employeeId: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Status</span>
          <select
            value={initialStatus}
            onChange={(event) => router.push(buildHref({ status: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">All statuses</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
      </div>

      <div className="flex justify-end">
        <Link
          href={exportHref}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Export CSV
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No labor work assignments match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Shift start</th>
                <th className="px-4 py-3">Work started</th>
                <th className="px-4 py-3">Work completed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Ref prep</th>
                <th className="px-4 py-3">Ref wash</th>
                <th className="px-4 py-3">Ref service</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.employeeName}</td>
                  <td className="px-4 py-3">{item.clientName}</td>
                  <td className="px-4 py-3">{item.address}</td>
                  <td className="px-4 py-3">{item.serviceName}</td>
                  <td className="px-4 py-3">{new Date(item.shiftScheduledStartUtc).toLocaleString()}</td>
                  <td className="px-4 py-3">{new Date(item.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {item.completedAt ? new Date(item.completedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">{item.status.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{item.progressPercent}%</td>
                  <td className="px-4 py-3">{formatLaborWorkDuration(item.referencePrepMinutes)}</td>
                  <td className="px-4 py-3">{formatLaborWorkDuration(item.referenceWashMinutes)}</td>
                  <td className="px-4 py-3">{formatLaborWorkDuration(item.referenceServiceMinutes)}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">{item.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
