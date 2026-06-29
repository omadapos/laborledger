"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ReviewDetailDrawer } from "./review-detail-drawer";
import {
  ESTIMATES_DISCLAIMER,
  filterReviewShiftsByQuery,
  formatReviewClockRange,
  formatReviewDate,
  formatReviewMinutes,
  groupReviewShiftsByDate,
  reviewStatusLabel,
  REVIEW_STATUS_OPTIONS,
  warningBadgeLabel,
  type ReviewShiftRecord,
  type ReviewStatusFilter
} from "../lib/review-utils";
import {
  addDaysToDateKey,
  formatDateKeyLabel,
  formatShiftTimeRange,
  getMondayWeekStart,
  type CompanyRecord,
  type EmployeeOption,
  type LocationOption
} from "../lib/shift-utils";

type ReviewWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly shifts: ReviewShiftRecord[];
  readonly employees: EmployeeOption[];
  readonly locations: LocationOption[];
  readonly initialWeekStart: string;
  readonly initialLocationId: string;
  readonly initialEmployeeId: string;
  readonly initialStatus: ReviewStatusFilter;
  readonly initialQuery: string;
};

function WarningBadge({ code }: { code: ReviewShiftRecord["warnings"][number]["code"] }) {
  const tone =
    ["missing_clock_in", "missing_clock_out", "open_break", "invalid_punch_sequence", "incomplete_shift"].includes(
      code
    )
      ? "border-red-200 bg-red-50 text-red-700"
      : code === "additional_time_pending"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-yellow-200 bg-yellow-50 text-yellow-800";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {warningBadgeLabel(code)}
    </span>
  );
}

export function ReviewWorkspace({
  companies,
  selectedCompany,
  shifts,
  employees,
  locations,
  initialWeekStart,
  initialLocationId,
  initialEmployeeId,
  initialStatus,
  initialQuery
}: ReviewWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selectedShift, setSelectedShift] = useState<ReviewShiftRecord | null>(null);
  const [detailShift, setDetailShift] = useState<ReviewShiftRecord | null>(null);
  const [busyShiftId, setBusyShiftId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredShifts = useMemo(() => filterReviewShiftsByQuery(shifts, query), [shifts, query]);
  const groupedShifts = useMemo(() => groupReviewShiftsByDate(filteredShifts), [filteredShifts]);

  function buildReviewHref(overrides: {
    companyId?: string;
    weekStart?: string;
    locationId?: string;
    employeeId?: string;
    status?: ReviewStatusFilter;
    q?: string;
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

    const status = overrides.status ?? initialStatus;
    if (status) {
      params.set("status", status);
    }

    const search = overrides.q ?? query;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    return `/review?${params.toString()}`;
  }

  async function loadShiftDetail(shiftId: string) {
    const response = await fetch(`/api/company-operations/shifts/${shiftId}/review`);
    if (!response.ok) {
      throw new Error("Unable to load shift detail.");
    }

    return (await response.json()) as ReviewShiftRecord;
  }

  async function handleViewDetails(shift: ReviewShiftRecord) {
    setActionError(null);
    setSelectedShift(shift);

    try {
      const detail = await loadShiftDetail(shift.shiftId);
      setDetailShift(detail);
    } catch {
      setActionError("Unable to load shift detail.");
      setDetailShift(shift);
    }
  }

  async function handleApproveShift(shiftId: string) {
    setBusyShiftId(shiftId);
    setActionError(null);

    const response = await fetch(`/api/company-operations/shifts/${shiftId}/approve`, {
      method: "POST"
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      setActionError(payload.message ?? "Unable to approve shift.");
      setBusyShiftId(null);
      return;
    }

    setBusyShiftId(null);
    setDetailShift(null);
    setSelectedShift(null);
    router.refresh();
  }

  async function handleApproveAdditionalTime(shiftId: string) {
    setBusyShiftId(shiftId);
    setActionError(null);

    const response = await fetch(`/api/company-operations/shifts/${shiftId}/approve-additional-time`, {
      method: "POST"
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      setActionError(payload.message ?? "Unable to approve additional time.");
      setBusyShiftId(null);
      return;
    }

    try {
      const detail = await loadShiftDetail(shiftId);
      setDetailShift(detail);
    } catch {
      setActionError("Approved additional time but could not refresh detail.");
    }

    setBusyShiftId(null);
    router.refresh();
  }

  const weekEnd = addDaysToDateKey(initialWeekStart, 6);
  const previousWeekStart = addDaysToDateKey(initialWeekStart, -7);
  const nextWeekStart = addDaysToDateKey(initialWeekStart, 7);

  return (
    <>
      <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        {ESTIMATES_DISCLAIMER}
      </p>

      {actionError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
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
                  href={buildReviewHref({ companyId: company.id })}
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
                href={buildReviewHref({ weekStart: previousWeekStart })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Previous
              </Link>
              <span className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800">
                {formatDateKeyLabel(initialWeekStart)} – {formatDateKeyLabel(weekEnd)}
              </span>
              <Link
                href={buildReviewHref({ weekStart: nextWeekStart })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Next
              </Link>
              <Link
                href={buildReviewHref({ weekStart: getMondayWeekStart() })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                This week
              </Link>
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="review-search">
              Search
            </label>
            <input
              id="review-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by employee, client, or location…"
              className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="review-location-filter">
              Location
            </label>
            <select
              id="review-location-filter"
              value={initialLocationId}
              onChange={(event) => {
                router.push(buildReviewHref({ locationId: event.target.value }));
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
            <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="review-employee-filter">
              Employee
            </label>
            <select
              id="review-employee-filter"
              value={initialEmployeeId}
              onChange={(event) => {
                router.push(buildReviewHref({ employeeId: event.target.value }));
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

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="review-status-filter">
              Status
            </label>
            <select
              id="review-status-filter"
              value={initialStatus}
              onChange={(event) => {
                router.push(buildReviewHref({ status: event.target.value as ReviewStatusFilter }));
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              {REVIEW_STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredShifts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">No shifts match this review queue.</p>
          <p className="mt-1 text-sm text-slate-500">
            Completed kiosk punch sessions for the selected week and filters will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Actual</th>
                  <th className="px-4 py-3">Break</th>
                  <th className="px-4 py-3">Worked</th>
                  <th className="px-4 py-3">Warnings</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedShifts.flatMap(([, dayShifts]) =>
                  dayShifts.map((shift) => {
                    const timeZone = shift.location.timezone;
                    return (
                      <tr key={shift.shiftId} className="text-slate-700">
                        <td className="px-4 py-3">{formatReviewDate(shift.scheduledStartUtc, timeZone)}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{shift.employee.fullName}</td>
                        <td className="px-4 py-3">{shift.serviceClient.name}</td>
                        <td className="px-4 py-3">{shift.location.name}</td>
                        <td className="px-4 py-3">
                          {formatShiftTimeRange(shift.scheduledStartUtc, shift.scheduledEndUtc, timeZone)}
                        </td>
                        <td className="px-4 py-3">
                          {formatReviewClockRange(shift.clockInUtc, shift.clockOutUtc, timeZone)}
                        </td>
                        <td className="px-4 py-3">{formatReviewMinutes(shift.breakDurationMinutes)}</td>
                        <td className="px-4 py-3">{formatReviewMinutes(shift.workedMinutes)}</td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {shift.warnings.slice(0, 3).map((warning) => (
                              <WarningBadge key={warning.code} code={warning.code} />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">{reviewStatusLabel(shift.displayStatus)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewDetails(shift)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              View
                            </button>
                            {shift.canApproveShift ? (
                              <button
                                type="button"
                                disabled={busyShiftId === shift.shiftId}
                                onClick={() => handleApproveShift(shift.shiftId)}
                                className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                              >
                                Approve
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 lg:hidden">
            {filteredShifts.map((shift) => {
              const timeZone = shift.location.timezone;
              return (
                <article key={shift.shiftId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{shift.employee.fullName}</h3>
                      <p className="text-xs text-slate-500">
                        {formatReviewDate(shift.scheduledStartUtc, timeZone)} · {shift.location.name}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {reviewStatusLabel(shift.displayStatus)}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Client</dt>
                      <dd>{shift.serviceClient.name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Worked</dt>
                      <dd>{formatReviewMinutes(shift.workedMinutes)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">Actual time</dt>
                      <dd>{formatReviewClockRange(shift.clockInUtc, shift.clockOutUtc, timeZone)}</dd>
                    </div>
                  </dl>

                  {shift.warnings.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {shift.warnings.map((warning) => (
                        <WarningBadge key={warning.code} code={warning.code} />
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewDetails(shift)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      View details
                    </button>
                    {shift.canApproveShift ? (
                      <button
                        type="button"
                        disabled={busyShiftId === shift.shiftId}
                        onClick={() => handleApproveShift(shift.shiftId)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Approve shift
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <ReviewDetailDrawer
        shift={detailShift ?? selectedShift}
        companyName={selectedCompany.name}
        onClose={() => {
          setSelectedShift(null);
          setDetailShift(null);
        }}
        onApproveShift={handleApproveShift}
        onApproveAdditionalTime={handleApproveAdditionalTime}
        busyShiftId={busyShiftId}
      />
    </>
  );
}
