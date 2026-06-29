"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CompanyRecord } from "../lib/employee-utils";
import {
  addDaysToDateKey,
  formatDateKeyLabel,
  type EmployeeOption,
  type LocationOption,
  type ServiceClientOption
} from "../lib/shift-utils";
import {
  buildLaborCsvHref,
  CLIENT_BILLING_DISCLAIMER,
  EMPLOYEE_PAY_DISCLAIMER,
  formatLaborMoney,
  formatLaborRate,
  formatPayableHours,
  weekStatusBadgeClass,
  type LaborPayBillingPreview
} from "../lib/labor-pay-billing-utils";
import {
  buildLaborWorkContextHref,
  LABOR_WORK_LOG_DISCLAIMER,
  type LaborWorkWeekSummary
} from "../lib/labor-work-log-utils";

type LaborPayBillingWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly preview: LaborPayBillingPreview;
  readonly workContextSummary: LaborWorkWeekSummary;
  readonly locations: LocationOption[];
  readonly serviceClients: ServiceClientOption[];
  readonly employees: EmployeeOption[];
  readonly canManageCompany: boolean;
  readonly initialWeekStart: string;
  readonly initialServiceClientId: string;
  readonly initialLocationId: string;
  readonly initialEmployeeId: string;
  readonly initialOnlyClosedWeeks: boolean;
  readonly thisWeekStart: string;
};

export function LaborPayBillingWorkspace({
  companies,
  selectedCompany,
  preview,
  workContextSummary,
  locations,
  serviceClients,
  employees,
  canManageCompany,
  initialWeekStart,
  initialServiceClientId,
  initialLocationId,
  initialEmployeeId,
  initialOnlyClosedWeeks,
  thisWeekStart
}: LaborPayBillingWorkspaceProps) {
  const router = useRouter();
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  const previousWeekStart = addDaysToDateKey(initialWeekStart, -7);
  const nextWeekStart = addDaysToDateKey(initialWeekStart, 7);

  function buildHref(overrides: {
    companyId?: string;
    weekStart?: string;
    serviceClientId?: string;
    locationId?: string;
    employeeId?: string;
    onlyClosedWeeks?: boolean;
  }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);
    params.set("weekStart", overrides.weekStart ?? initialWeekStart);

    const serviceClientId = overrides.serviceClientId ?? initialServiceClientId;
    if (serviceClientId) {
      params.set("serviceClientId", serviceClientId);
    }

    const locationId = overrides.locationId ?? initialLocationId;
    if (locationId) {
      params.set("locationId", locationId);
    }

    const employeeId = overrides.employeeId ?? initialEmployeeId;
    if (employeeId) {
      params.set("employeeId", employeeId);
    }

    const onlyClosedWeeks = overrides.onlyClosedWeeks ?? initialOnlyClosedWeeks;
    if (onlyClosedWeeks) {
      params.set("onlyClosedWeeks", "true");
    }

    return `/labor-billing?${params.toString()}`;
  }

  async function handleCreateDraft() {
    setDraftMessage(null);
    const response = await fetch(
      `/api/company-operations/companies/${selectedCompany.id}/labor-pay-billing/drafts`,
      { method: "POST" }
    );
    const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };

    setDraftMessage(
      typeof payload.message === "string"
        ? payload.message
        : Array.isArray(payload.message)
          ? payload.message.join(" ")
          : "Labor billing drafts are not available in this slice."
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">One screen for pay prep and client labor billing</p>
        <p className="mt-2">
          Review approved payable minutes by employee and by service client for the selected workweek. Use CSV
          exports for handoff — this is not tax payroll or an issued invoice.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-600" htmlFor="labor-company-select">
          Company
        </label>
        <select
          id="labor-company-select"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          value={selectedCompany.id}
          onChange={(event) => router.push(buildHref({ companyId: event.target.value }))}
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>

        <Link href={buildHref({ weekStart: previousWeekStart })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          Previous week
        </Link>
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900">
          {formatDateKeyLabel(preview.periodStart)} → {formatDateKeyLabel(preview.periodEnd)}
        </span>
        <Link href={buildHref({ weekStart: nextWeekStart })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          Next week
        </Link>
        <Link href={buildHref({ weekStart: thisWeekStart })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          This week
        </Link>
        <span className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${weekStatusBadgeClass(preview.weekStatus)}`}>
          {preview.weekStatus}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label="Service client"
          value={initialServiceClientId}
          onChange={(value) => router.push(buildHref({ serviceClientId: value }))}
          options={[{ id: "", name: "All clients" }, ...serviceClients.map((c) => ({ id: c.id, name: c.name }))]}
        />
        <FilterSelect
          label="Location"
          value={initialLocationId}
          onChange={(value) => router.push(buildHref({ locationId: value }))}
          options={[{ id: "", name: "All locations" }, ...locations.map((l) => ({ id: l.id, name: l.name }))]}
        />
        {canManageCompany ? (
          <FilterSelect
            label="Employee"
            value={initialEmployeeId}
            onChange={(value) => router.push(buildHref({ employeeId: value }))}
            options={[{ id: "", name: "All employees" }, ...employees.map((e) => ({ id: e.id, name: e.fullName }))]}
          />
        ) : null}
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={initialOnlyClosedWeeks}
            onChange={(event) => router.push(buildHref({ onlyClosedWeeks: event.target.checked }))}
          />
          Only closed weeks
        </label>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Operational work context</h2>
            <p className="mt-1 text-xs text-slate-500">{LABOR_WORK_LOG_DISCLAIMER}</p>
          </div>
          <Link
            href={buildLaborWorkContextHref({
              companyId: selectedCompany.id,
              periodStart: preview.periodStart,
              periodEnd: preview.periodEnd,
              ...(initialServiceClientId ? { serviceClientId: initialServiceClientId } : {}),
              ...(initialLocationId ? { locationId: initialLocationId } : {})
            })}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
          >
            View Labor Work Log
          </Link>
        </div>
        {workContextSummary.total > 0 ? (
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <SummaryItem label="Work assignments this week" value={String(workContextSummary.total)} />
            <SummaryItem label="Completed" value={String(workContextSummary.completed)} />
            <SummaryItem label="Blocked" value={String(workContextSummary.blocked)} />
            <SummaryItem label="In progress" value={String(workContextSummary.inProgress)} />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No operational work assignments match the selected week and filters.</p>
        )}
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-900">{preview.dataSourceLabel}</p>
        {preview.snapshotVersion ? (
          <p className="mt-1 text-xs text-slate-500">Snapshot version v{preview.snapshotVersion}</p>
        ) : null}
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label="Approved shifts" value={String(preview.totals.approvedShiftCount)} />
          <SummaryItem label="Payable time" value={formatPayableHours(preview.totals.payableMinutes)} />
          <SummaryItem
            label="Employee gross estimate"
            value={formatLaborMoney(preview.totals.employeeGrossEstimateMinor, preview.currencyCode)}
          />
          <SummaryItem
            label="Client labor estimate"
            value={formatLaborMoney(preview.totals.clientLaborEstimateMinor, preview.currencyCode)}
          />
        </dl>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={buildLaborCsvHref("payroll", selectedCompany.id, preview.filters)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Export employee pay CSV
        </a>
        <a
          href={buildLaborCsvHref("client-billing", selectedCompany.id, preview.filters)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Export client billing CSV
        </a>
        {canManageCompany ? (
          <button
            type="button"
            onClick={() => void handleCreateDraft()}
            className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create labor billing draft
          </button>
        ) : null}
      </div>

      {draftMessage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{draftMessage}</p>
      ) : null}

      {preview.excludedShifts.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Excluded shifts</h2>
          <p className="mt-1 text-sm text-amber-800">
            These shifts are not included in pay prep or client billing totals.
          </p>
          <ul className="mt-3 space-y-2">
            {preview.excludedShifts.map((item) => (
              <li key={item.shiftId} className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-slate-700">
                <p className="font-medium text-slate-900">
                  {item.employeeName} · {item.locationName}
                </p>
                <p className="mt-1 text-xs text-slate-500">{item.message}</p>
                <Link
                  href={`/review?companyId=${selectedCompany.id}&weekStart=${initialWeekStart}`}
                  className="mt-2 inline-block text-xs font-medium text-slate-900 underline"
                >
                  Open Review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">For employee pay prep</h2>
          <p className="text-xs text-slate-500">{EMPLOYEE_PAY_DISCLAIMER}</p>
        </div>
        {preview.employeePayPrep.length === 0 ? (
          <EmptyState
            message={
              initialOnlyClosedWeeks
                ? "No closed-week snapshot matches the current filters. Uncheck “Only closed weeks” or close the week in Weekly Close."
                : preview.totals.approvedShiftCount === 0
                  ? "No approved payable hours for this workweek. Approve shifts in Review, try Previous week, or re-run pnpm seed:demo for local demo data."
                  : "No approved payable hours match the current filters."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Approved minutes</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Gross estimate</th>
                </tr>
              </thead>
              <tbody>
                {preview.employeePayPrep.map((row) => (
                  <tr key={`${row.employeeId}-${row.locationId}-${row.serviceClientId}`} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.employeeName}</td>
                    <td className="px-4 py-3">{row.serviceClientName}</td>
                    <td className="px-4 py-3">{row.locationName}</td>
                    <td className="px-4 py-3">
                      {row.approvedPayableMinutes} ({row.approvedPayableHoursDecimal}h)
                    </td>
                    <td className="px-4 py-3">{formatLaborRate(row.employeeRateMinor, preview.currencyCode)}</td>
                    <td className="px-4 py-3">{formatLaborMoney(row.estimatedGrossPayMinor, preview.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">For client labor billing</h2>
          <p className="text-xs text-slate-500">{CLIENT_BILLING_DISCLAIMER}</p>
        </div>
        {preview.clientLaborBilling.length === 0 ? (
          <EmptyState
            message={
              initialOnlyClosedWeeks
                ? "No closed-week billing rows match the current filters."
                : preview.totals.approvedShiftCount === 0
                  ? "No billable labor rows for this workweek yet. Approved shifts with payable minutes appear here after Review approval."
                  : "No billable labor rows match the current filters."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Service client</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Billable minutes</th>
                  <th className="px-4 py-3">Client rate</th>
                  <th className="px-4 py-3">Charge estimate</th>
                  <th className="px-4 py-3">Margin</th>
                </tr>
              </thead>
              <tbody>
                {preview.clientLaborBilling.map((row) => (
                  <tr key={`${row.serviceClientId}-${row.locationId}-${row.employeeId}`} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.serviceClientName}</td>
                    <td className="px-4 py-3">{row.locationName}</td>
                    <td className="px-4 py-3">{row.employeeName}</td>
                    <td className="px-4 py-3">
                      {row.approvedBillableMinutes} ({row.approvedBillableHoursDecimal}h)
                    </td>
                    <td className="px-4 py-3">{formatLaborRate(row.clientLaborRateMinor, preview.currencyCode)}</td>
                    <td className="px-4 py-3">{formatLaborMoney(row.estimatedClientChargeMinor, preview.currencyCode)}</td>
                    <td className="px-4 py-3">{formatLaborMoney(row.estimatedMarginMinor, preview.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string }>;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block text-sm text-slate-600" htmlFor={id}>
      {label}
      <select
        id={id}
        className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id || "all"} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </p>
  );
}
