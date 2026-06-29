"use client";

import Link from "next/link";
import { useState } from "react";

import { CreateWorkOrderForm } from "./create-work-order-form";
import { EditWorkOrderForm } from "./edit-work-order-form";
import { WorkOrderDetailDrawer } from "./work-order-detail-drawer";
import { WorkOrderStatusBadge } from "./work-order-status-badge";
import type { CompanyRecord, EmployeeRecord } from "../lib/employee-utils";
import type { LocationRecord, ServiceClientRecord } from "../lib/location-utils";
import type { ServiceCatalogListRecord } from "../lib/service-catalog-utils";
import type { VehicleListRecord } from "../lib/vehicle-utils";
import {
  formatWorkOrderDate,
  formatWorkOrderMoney,
  formatAssignedEmployeeLabel,
  formatWorkOrderStatusLabel,
  formatWorkOrderVehicleSummary,
  workOrderDisclaimer,
  workOrdersEmptyMessage,
  WORK_ORDER_STATUS_OPTIONS,
  type WorkOrderListRecord
} from "../lib/work-order-utils";

type WorkOrdersWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly workOrders: WorkOrderListRecord[];
  readonly vehicles: VehicleListRecord[];
  readonly catalogItems: ServiceCatalogListRecord[];
  readonly serviceClients: ServiceClientRecord[];
  readonly locations: LocationRecord[];
  readonly employees: EmployeeRecord[];
  readonly initialQuery: string;
  readonly initialStatus: string;
  readonly initialServiceClientId: string;
  readonly initialLocationId: string;
};

export function WorkOrdersWorkspace({
  companies,
  selectedCompany,
  workOrders,
  vehicles,
  catalogItems,
  serviceClients,
  locations,
  employees,
  initialQuery,
  initialStatus,
  initialServiceClientId,
  initialLocationId
}: WorkOrdersWorkspaceProps) {
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);

  const selectedWorkOrder =
    workOrders.find((workOrder) => workOrder.id === selectedWorkOrderId) ?? null;

  const activeClients = serviceClients.filter((client) => !client.archivedAt);
  const activeLocations = locations.filter((location) => !location.archivedAt);
  const emptyCopy = workOrdersEmptyMessage(workOrders.length > 0);

  function buildHref(overrides: {
    companyId?: string;
    status?: string;
    q?: string;
    serviceClientId?: string;
    locationId?: string;
  }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);

    const status = overrides.status ?? initialStatus;
    if (status) {
      params.set("status", status);
    }

    const search = overrides.q ?? initialQuery;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    const serviceClientId =
      overrides.serviceClientId !== undefined ? overrides.serviceClientId : initialServiceClientId;
    if (serviceClientId) {
      params.set("serviceClientId", serviceClientId);
    }

    const locationId = overrides.locationId !== undefined ? overrides.locationId : initialLocationId;
    if (locationId) {
      params.set("locationId", locationId);
    }

    return `/work-orders?${params.toString()}`;
  }

  return (
    <>
      <p className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        {workOrderDisclaimer()}
      </p>

      <div className="mb-6">
        <CreateWorkOrderForm
          companyId={selectedCompany.id}
          vehicles={vehicles}
          catalogItems={catalogItems}
        />
      </div>

      {companies.length > 1 ? (
        <div className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company</p>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompany.id;
              return (
                <Link
                  key={company.id}
                  href={buildHref({ companyId: company.id })}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 font-medium text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {company.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
        <form method="get" className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <input type="hidden" name="companyId" value={selectedCompany.id} />
          {initialStatus ? <input type="hidden" name="status" value={initialStatus} /> : null}
          {initialServiceClientId ? (
            <input type="hidden" name="serviceClientId" value={initialServiceClientId} />
          ) : null}
          {initialLocationId ? <input type="hidden" name="locationId" value={initialLocationId} /> : null}

          <div className="flex-1">
            <label
              className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400"
              htmlFor="work-order-search"
            >
              Search
            </label>
            <input
              id="work-order-search"
              name="q"
              type="search"
              defaultValue={initialQuery}
              placeholder="Search by work order #, VIN, plate, make/model, or service…"
              className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Apply search
          </button>
        </form>

        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Link
                href={buildHref({ status: "" })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  !initialStatus
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                All
              </Link>
              {WORK_ORDER_STATUS_OPTIONS.map((status) => {
                const isSelected = initialStatus === status;
                return (
                  <Link
                    key={status}
                    href={buildHref({ status })}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {formatWorkOrderStatusLabel(status)}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Service client</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Link
                href={buildHref({ serviceClientId: "", locationId: "" })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  !initialServiceClientId
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                All
              </Link>
              {activeClients.map((client) => {
                const isSelected = initialServiceClientId === client.id;
                return (
                  <Link
                    key={client.id}
                    href={buildHref({ serviceClientId: client.id, locationId: "" })}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {client.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {initialServiceClientId ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Location</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Link
                  href={buildHref({ locationId: "" })}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    !initialLocationId
                      ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  All
                </Link>
                {activeLocations
                  .filter((location) => location.serviceClientId === initialServiceClientId)
                  .map((location) => {
                    const isSelected = initialLocationId === location.id;
                    return (
                      <Link
                        key={location.id}
                        href={buildHref({ locationId: location.id })}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                          isSelected
                            ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {location.name}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {workOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">{emptyCopy.title}</p>
          <p className="mt-2 text-sm text-slate-500">{emptyCopy.description}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Work order
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Status
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Assigned
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Vehicle
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Client / location
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Services
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Total
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Created
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workOrders.map((workOrder) => (
                    <tr key={workOrder.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{workOrder.workOrderNumber}</td>
                      <td className="px-5 py-3.5">
                        <WorkOrderStatusBadge status={workOrder.status} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {formatAssignedEmployeeLabel(workOrder.assignedEmployee)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <span className="block">{formatWorkOrderVehicleSummary(workOrder.vehicle)}</span>
                        {workOrder.vehicle.plate ? (
                          <span className="text-xs text-slate-400">Plate {workOrder.vehicle.plate}</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {workOrder.serviceClient.name}
                        <span className="block text-xs text-slate-400">{workOrder.location.name}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{workOrder.serviceLineCount}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {formatWorkOrderMoney(
                          workOrder.totalServiceAmountMinor,
                          workOrder.serviceLines[0]?.currencyCode ?? "USD"
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{formatWorkOrderDate(workOrder.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedWorkOrderId(workOrder.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          <EditWorkOrderForm workOrder={workOrder} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {workOrders.map((workOrder) => (
              <article
                key={workOrder.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{workOrder.workOrderNumber}</p>
                    <p className="mt-1 text-sm text-slate-700">{formatWorkOrderVehicleSummary(workOrder.vehicle)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {workOrder.serviceClient.name} · {workOrder.location.name}
                    </p>
                  </div>
                  <WorkOrderStatusBadge status={workOrder.status} />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-800">
                  Assigned: {formatAssignedEmployeeLabel(workOrder.assignedEmployee)}
                </p>
                <p className="mt-3 text-sm font-medium text-slate-800">
                  {workOrder.serviceLineCount} service{workOrder.serviceLineCount === 1 ? "" : "s"} ·{" "}
                  {formatWorkOrderMoney(
                    workOrder.totalServiceAmountMinor,
                    workOrder.serviceLines[0]?.currencyCode ?? "USD"
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-400">Created {formatWorkOrderDate(workOrder.createdAt)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWorkOrderId(workOrder.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    View details
                  </button>
                  <EditWorkOrderForm workOrder={workOrder} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <WorkOrderDetailDrawer
        workOrder={selectedWorkOrder}
        companyName={selectedCompany.name}
        employees={employees}
        onClose={() => setSelectedWorkOrderId(null)}
      />
    </>
  );
}
