"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CorrectionDetailDrawer } from "./correction-detail-drawer";
import { CreateCorrectionForm } from "./create-correction-form";
import {
  CORRECTIONS_DISCLAIMER,
  CORRECTION_STATUS_OPTIONS,
  CORRECTION_TYPE_OPTIONS,
  correctionStatusLabel,
  filterCorrectionsByQuery,
  formatCorrectionDate,
  type CorrectionDetail,
  type CorrectionStatusFilter,
  type CorrectionSummary,
  type CorrectionTypeFilter
} from "../lib/correction-utils";
import {
  addDaysToDateKey,
  formatDateKeyLabel,
  getMondayWeekStart,
  type CompanyRecord,
  type EmployeeOption,
  type LocationOption
} from "../lib/shift-utils";

type ShiftOption = {
  shiftId: string;
  employeeName: string;
  locationName: string;
  scheduledStartUtc: string;
  punchTimeline?: Array<{ id: string; action: string; eventUtc: string }>;
};

type CorrectionsWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly corrections: CorrectionSummary[];
  readonly shiftOptions: ShiftOption[];
  readonly employees: EmployeeOption[];
  readonly locations: LocationOption[];
  readonly canManageCompany?: boolean;
  readonly initialWeekStart: string;
  readonly initialLocationId: string;
  readonly initialEmployeeId: string;
  readonly initialStatus: CorrectionStatusFilter;
  readonly initialType: CorrectionTypeFilter;
  readonly initialQuery: string;
};

export function CorrectionsWorkspace({
  companies,
  selectedCompany,
  corrections,
  shiftOptions,
  employees,
  locations,
  canManageCompany = true,
  initialWeekStart,
  initialLocationId,
  initialEmployeeId,
  initialStatus,
  initialType,
  initialQuery
}: CorrectionsWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [detail, setDetail] = useState<CorrectionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => filterCorrectionsByQuery(corrections, query), [corrections, query]);

  function buildHref(overrides: Partial<{
    companyId: string;
    weekStart: string;
    locationId: string;
    employeeId: string;
    status: CorrectionStatusFilter;
    type: CorrectionTypeFilter;
    q: string;
  }>) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);
    params.set("weekStart", overrides.weekStart ?? initialWeekStart);
    const locationId = overrides.locationId ?? initialLocationId;
    if (locationId) params.set("locationId", locationId);
    const employeeId = overrides.employeeId ?? initialEmployeeId;
    if (employeeId) params.set("employeeId", employeeId);
    const status = overrides.status ?? initialStatus;
    if (status) params.set("status", status);
    const type = overrides.type ?? initialType;
    if (type) params.set("type", type);
    const search = overrides.q ?? query;
    if (search.trim()) params.set("q", search.trim());
    return `/corrections?${params.toString()}`;
  }

  async function openDetail(id: string) {
    setError(null);
    const response = await fetch(`/api/company-operations/corrections/${id}`);
    const payload = (await response.json().catch(() => ({}))) as CorrectionDetail & { message?: string };
    if (!response.ok) {
      setError(payload.message ?? "Unable to load correction detail.");
      return;
    }
    setDetail(payload);
  }

  const weekEnd = addDaysToDateKey(initialWeekStart, 6);

  return (
    <>
      <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">{CORRECTIONS_DISCLAIMER}</p>
      {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {canManageCompany ? (
        <CreateCorrectionForm companyId={selectedCompany.id} shiftOptions={shiftOptions} />
      ) : null}

      {companies.length > 1 ? (
        <div className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company</p>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => (
              <Link key={company.id} href={buildHref({ companyId: company.id })} className={`rounded-lg border px-3 py-1.5 text-sm ${company.id === selectedCompany.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                {company.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-4 space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={buildHref({ weekStart: addDaysToDateKey(initialWeekStart, -7) })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">Previous</Link>
          <span className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800">{formatDateKeyLabel(initialWeekStart)} – {formatDateKeyLabel(weekEnd)}</span>
          <Link href={buildHref({ weekStart: addDaysToDateKey(initialWeekStart, 7) })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">Next</Link>
          <Link href={buildHref({ weekStart: getMondayWeekStart() })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">This week</Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <select value={initialLocationId} onChange={(e) => router.push(buildHref({ locationId: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">All locations</option>
            {locations.filter((l) => !l.archivedAt).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={initialEmployeeId} onChange={(e) => router.push(buildHref({ employeeId: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">All employees</option>
            {employees.filter((e) => !e.archivedAt).map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </select>
          <select value={initialStatus} onChange={(e) => router.push(buildHref({ status: e.target.value as CorrectionStatusFilter }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            {CORRECTION_STATUS_OPTIONS.map((o) => <option key={o.value || "all"} value={o.value}>{o.label}</option>)}
          </select>
          <select value={initialType} onChange={(e) => router.push(buildHref({ type: e.target.value as CorrectionTypeFilter }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            {CORRECTION_TYPE_OPTIONS.map((o) => <option key={o.value || "all"} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search corrections…" className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">No correction requests match these filters.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Requested by</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((correction) => (
                  <tr key={correction.id}>
                    <td className="px-4 py-3">{formatCorrectionDate(correction.scheduledStartUtc, correction.shiftTimezone)}</td>
                    <td className="px-4 py-3 font-medium">{correction.employee.fullName}</td>
                    <td className="px-4 py-3">{correction.location.name}</td>
                    <td className="px-4 py-3">{correction.typeLabel}</td>
                    <td className="px-4 py-3">{correctionStatusLabel(correction.status)}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{correction.reason}</td>
                    <td className="px-4 py-3">{correction.requestedByLabel}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openDetail(correction.id)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 lg:hidden">
            {filtered.map((correction) => (
              <article key={correction.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{correction.employee.fullName}</h3>
                    <p className="text-xs text-slate-500">{correction.typeLabel} · {correction.location.name}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px]">{correctionStatusLabel(correction.status)}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{correction.reason}</p>
                <button type="button" onClick={() => openDetail(correction.id)} className="mt-4 rounded-lg border border-slate-200 px-3 py-1.5 text-xs">View details</button>
              </article>
            ))}
          </div>
        </>
      )}

      <CorrectionDetailDrawer
        correction={detail}
        onClose={() => setDetail(null)}
        onChanged={() => {
          setDetail(null);
          router.refresh();
        }}
      />
    </>
  );
}
