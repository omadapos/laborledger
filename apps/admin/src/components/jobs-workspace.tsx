"use client";

import Link from "next/link";

import { WorkOrderStatusBadge } from "./work-order-status-badge";
import { WORK_ORDER_STATUS_OPTIONS, type WorkOrderListRecord } from "../lib/work-order-utils";
import {
  buildJobsClearFiltersHref,
  countAssignedWorkers,
  formatJobCompletedAt,
  formatJobCreatedAt,
  formatJobInvoiceStatus,
  formatJobVehicleSummary,
  hasActiveJobsFilters,
  jobsEmptyMessage,
  JOBS_CLEAR_FILTERS_CTA,
  JOBS_RECEIVE_VEHICLE_CTA,
  receptionRoute,
  jobDetailRoute
} from "../lib/jobs-utils";

type JobsWorkspaceProps = {
  readonly workOrders: WorkOrderListRecord[];
  readonly initialQuery: string;
  readonly initialStatus: string;
  readonly initialServiceClientId: string;
  readonly initialLocationId: string;
  readonly canManageCompany: boolean;
};

export function JobsWorkspace({
  workOrders,
  initialQuery,
  initialStatus,
  initialServiceClientId,
  initialLocationId,
  canManageCompany
}: JobsWorkspaceProps) {
  const listFilters = {
    q: initialQuery,
    status: initialStatus,
    serviceClientId: initialServiceClientId,
    locationId: initialLocationId
  };
  const filtersActive = hasActiveJobsFilters(listFilters);
  const emptyCopy = jobsEmptyMessage(listFilters);

  function buildHref(overrides: {
    status?: string;
    q?: string;
    serviceClientId?: string;
    locationId?: string;
  }) {
    const params = new URLSearchParams();

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

    const query = params.toString();
    return query ? `/jobs?${query}` : "/jobs";
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Company jobs are scoped to the active company. Newest jobs appear first.
        </p>
        {canManageCompany ? (
          <Link
            href={receptionRoute()}
            className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {JOBS_RECEIVE_VEHICLE_CTA}
          </Link>
        ) : null}
      </div>

      <div className="mb-4 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
        <form method="get" className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <label
              className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400"
              htmlFor="jobs-search"
            >
              Search by VIN
            </label>
            <input
              id="jobs-search"
              name="q"
              type="search"
              defaultValue={initialQuery}
              placeholder="VIN, plate, make, model, or work order number"
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Apply filters
          </button>
        </form>

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
            {WORK_ORDER_STATUS_OPTIONS.map((status) => (
              <Link
                key={status}
                href={buildHref({ status })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  initialStatus === status
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {workOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">{emptyCopy.title}</p>
          <p className="mt-2 text-sm text-slate-500">{emptyCopy.description}</p>
          {filtersActive ? (
            <Link
              href={buildJobsClearFiltersHref()}
              className="mt-4 inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {JOBS_CLEAR_FILTERS_CTA}
            </Link>
          ) : canManageCompany ? (
            <Link
              href={receptionRoute()}
              className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {JOBS_RECEIVE_VEHICLE_CTA}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Job
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Status
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Client / location
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Vehicle / VIN
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Services
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Workers
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Invoice
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workOrders.map((workOrder) => (
                    <tr key={workOrder.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3.5">
                        <Link href={jobDetailRoute(workOrder.id)} className="font-medium text-brand-700 hover:underline">
                          {workOrder.workOrderNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <WorkOrderStatusBadge status={workOrder.status} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {workOrder.serviceClient.name}
                        <span className="block text-xs text-slate-400">{workOrder.location.name}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <span className="block">{formatJobVehicleSummary(workOrder)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{workOrder.serviceLineCount}</td>
                      <td className="px-5 py-3.5 text-slate-600">{countAssignedWorkers(workOrder)}</td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {formatJobInvoiceStatus(workOrder.status)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{formatJobCreatedAt(workOrder.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {workOrders.map((workOrder) => (
              <Link
                key={workOrder.id}
                href={jobDetailRoute(workOrder.id)}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{workOrder.workOrderNumber}</p>
                    <p className="mt-1 text-sm text-slate-700">{formatJobVehicleSummary(workOrder)}</p>
                  </div>
                  <WorkOrderStatusBadge status={workOrder.status} />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {workOrder.serviceClient.name} · {workOrder.location.name}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {workOrder.serviceLineCount} services · {countAssignedWorkers(workOrder)} workers ·{" "}
                  {formatJobInvoiceStatus(workOrder.status)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Created {formatJobCreatedAt(workOrder.createdAt)}
                  {formatJobCompletedAt(workOrder) !== "—"
                    ? ` · Completed ${formatJobCompletedAt(workOrder)}`
                    : ""}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
