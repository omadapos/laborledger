"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CreateShiftForm } from "./create-shift-form";
import { CopyWeekForm } from "./copy-week-form";
import { CancelShiftForm, EditShiftForm } from "./scheduling-shift-actions";
import { ShiftStatusBadge } from "./shift-status-badge";
import {
  addDaysToDateKey,
  enrichShiftViews,
  filterShiftsByQuery,
  formatDateKeyLabel,
  formatShiftTimeRange,
  getMondayWeekStart,
  groupShiftsByStartDate,
  type CompanyRecord,
  type EmployeeOption,
  type LocationOption,
  type ServiceClientOption,
  type ShiftListRecord
} from "../lib/shift-utils";

type SchedulingWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly shifts: ShiftListRecord[];
  readonly employees: EmployeeOption[];
  readonly serviceClients: ServiceClientOption[];
  readonly locations: LocationOption[];
  readonly canManageCompany?: boolean;
  readonly initialWeekStart: string;
  readonly initialLocationId: string;
  readonly initialEmployeeId: string;
  readonly initialQuery: string;
  readonly initialIncludeCancelled: boolean;
};

export function SchedulingWorkspace({
  companies,
  selectedCompany,
  shifts,
  employees,
  serviceClients,
  locations,
  canManageCompany = true,
  initialWeekStart,
  initialLocationId,
  initialEmployeeId,
  initialQuery,
  initialIncludeCancelled
}: SchedulingWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [activeEditShiftId, setActiveEditShiftId] = useState<string | null>(null);
  const [activeCancelShiftId, setActiveCancelShiftId] = useState<string | null>(null);

  const shiftViews = useMemo(() => enrichShiftViews(shifts), [shifts]);
  const activeEditShift = activeEditShiftId
    ? shiftViews.find((shift) => shift.id === activeEditShiftId) ?? null
    : null;
  const activeCancelShift = activeCancelShiftId
    ? shiftViews.find((shift) => shift.id === activeCancelShiftId) ?? null
    : null;
  const filteredShifts = useMemo(() => filterShiftsByQuery(shiftViews, query), [shiftViews, query]);
  const groupedShifts = useMemo(() => groupShiftsByStartDate(filteredShifts), [filteredShifts]);

  function buildSchedulingHref(overrides: {
    companyId?: string;
    weekStart?: string;
    locationId?: string;
    employeeId?: string;
    q?: string;
    includeCancelled?: boolean;
  }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);
    params.set("weekStart", overrides.weekStart ?? initialWeekStart);

    const locationId = overrides.locationId ?? initialLocationId;
    if (locationId) {
      params.set("locationId", locationId);
    }

    const employeeId = overrides.employeeId ?? initialEmployeeId;
    if (employeeId) {
      params.set("employeeId", employeeId);
    }

    const search = overrides.q ?? query;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    const includeCancelled = overrides.includeCancelled ?? initialIncludeCancelled;
    if (includeCancelled) {
      params.set("includeCancelled", "true");
    }

    return `/scheduling?${params.toString()}`;
  }

  const weekEnd = addDaysToDateKey(initialWeekStart, 6);
  const previousWeekStart = addDaysToDateKey(initialWeekStart, -7);
  const nextWeekStart = addDaysToDateKey(initialWeekStart, 7);

  return (
    <>
      {canManageCompany ? (
        <>
          <div className="mb-6">
            <CreateShiftForm
              companyId={selectedCompany.id}
              employees={employees}
              serviceClients={serviceClients}
              locations={locations}
            />
          </div>
          <CopyWeekForm companyId={selectedCompany.id} initialSourceWeekStart={initialWeekStart} />
        </>
      ) : null}

      {companies.length > 1 ? (
        <div className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company</p>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompany.id;
              return (
                <Link
                  key={company.id}
                  href={buildSchedulingHref({ companyId: company.id })}
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

      <div className="mb-4 space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Week</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Link
                href={buildSchedulingHref({ weekStart: previousWeekStart })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Previous
              </Link>
              <span className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800">
                {formatDateKeyLabel(initialWeekStart)} – {formatDateKeyLabel(weekEnd)}
              </span>
              <Link
                href={buildSchedulingHref({ weekStart: nextWeekStart })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Next
              </Link>
              <Link
                href={buildSchedulingHref({ weekStart: getMondayWeekStart() })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                This week
              </Link>
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="shift-search">
              Search
            </label>
            <input
              id="shift-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by employee, client, or location…"
              className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={initialIncludeCancelled}
            onChange={(event) => {
              router.push(buildSchedulingHref({ includeCancelled: event.target.checked }));
            }}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Include cancelled shifts
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="shift-location-filter">
              Location
            </label>
            <select
              id="shift-location-filter"
              value={initialLocationId}
              onChange={(event) => {
                router.push(buildSchedulingHref({ locationId: event.target.value }));
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">All locations</option>
              {locations
                .filter((location) => !location.archivedAt)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="shift-employee-filter">
              Employee
            </label>
            <select
              id="shift-employee-filter"
              value={initialEmployeeId}
              onChange={(event) => {
                router.push(buildSchedulingHref({ employeeId: event.target.value }));
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">All employees</option>
              {employees
                .filter((employee) => !employee.archivedAt)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {filteredShifts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            {shifts.length === 0 ? "No shifts scheduled yet" : "No shifts match your filters"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {shifts.length === 0
              ? "Create a shift to schedule work for an employee at a company location."
              : "Try another week, location, employee, or search term."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedShifts.map((group) => (
            <section key={group.dateKey}>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">{group.label}</h2>

              <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30 md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                          Scheduled time
                        </th>
                        <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                          Employee
                        </th>
                        <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                          Service client
                        </th>
                        <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                          Location
                        </th>
                        <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                          Time zone
                        </th>
                        <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                          Status
                        </th>
                        {canManageCompany ? (
                          <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                            Actions
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.shifts.map((shift) => (
                        <tr key={shift.id} className="transition hover:bg-slate-50/80">
                          <td className="px-5 py-3.5 text-slate-700">
                            {formatShiftTimeRange(shift.scheduledStartUtc, shift.scheduledEndUtc, shift.timezone)}
                            {shift.isOvernight ? (
                              <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                                Overnight
                              </span>
                            ) : null}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-900">{shift.employee?.fullName ?? "—"}</td>
                          <td className="px-5 py-3.5 text-slate-700">{shift.serviceClient?.name ?? "—"}</td>
                          <td className="px-5 py-3.5 text-slate-700">{shift.location?.name ?? "—"}</td>
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{shift.timezone}</td>
                          <td className="px-5 py-3.5">
                            <ShiftStatusBadge status={shift.status} />
                          </td>
                          {canManageCompany ? (
                            <td className="px-5 py-3.5">
                              {shift.status === "SCHEDULED" ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveCancelShiftId(null);
                                      setActiveEditShiftId(shift.id);
                                    }}
                                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveEditShiftId(null);
                                      setActiveCancelShiftId(shift.id);
                                    }}
                                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 md:hidden">
                {group.shifts.map((shift) => (
                  <article
                    key={shift.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{shift.employee?.fullName ?? "—"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatShiftTimeRange(shift.scheduledStartUtc, shift.scheduledEndUtc, shift.timezone)}
                        </p>
                      </div>
                      <ShiftStatusBadge status={shift.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{shift.serviceClient?.name ?? "—"}</p>
                    <p className="mt-1 text-xs text-slate-600">{shift.location?.name ?? "—"}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{shift.timezone}</p>
                    {shift.isOvernight ? (
                      <p className="mt-2 text-xs font-medium text-slate-500">Overnight shift</p>
                    ) : null}
                    {canManageCompany && shift.status === "SCHEDULED" ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCancelShiftId(null);
                            setActiveEditShiftId(shift.id);
                          }}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveEditShiftId(null);
                            setActiveCancelShiftId(shift.id);
                          }}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeEditShift ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg">
            <EditShiftForm
              shift={activeEditShift}
              employees={employees}
              onClose={() => setActiveEditShiftId(null)}
            />
          </div>
        </div>
      ) : null}

      {activeCancelShift ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg">
            <CancelShiftForm shift={activeCancelShift} onClose={() => setActiveCancelShiftId(null)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
