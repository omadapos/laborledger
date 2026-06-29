"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { CompanyRecord } from "../lib/employee-utils";
import { addDaysToDateKey, getMondayWeekStart } from "../lib/shift-utils";
import {
  blockerReviewHref,
  blockerTypeLabel,
  ESTIMATES_DISCLAIMER,
  formatEstimateAmount,
  formatPayableHours,
  formatWeekRange,
  groupBlockersByType,
  validateReopenReason,
  WEEKLY_CLOSE_DISCLAIMER,
  weeklyStatusBadgeClass,
  weeklyStatusLabel,
  type WeeklyCloseSummary
} from "../lib/weekly-close-utils";

type WeeklyCloseWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly summary: WeeklyCloseSummary;
  readonly initialWeekStart: string;
};

export function WeeklyCloseWorkspace({
  companies,
  selectedCompany,
  summary,
  initialWeekStart
}: WeeklyCloseWorkspaceProps) {
  const router = useRouter();
  const [closeNote, setCloseNote] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);

  const blockerGroups = useMemo(() => groupBlockersByType(summary.blockers), [summary.blockers]);
  const previousWeekStart = addDaysToDateKey(initialWeekStart, -7);
  const nextWeekStart = addDaysToDateKey(initialWeekStart, 7);

  function buildHref(overrides: { companyId?: string; weekStart?: string }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);
    params.set("weekStart", overrides.weekStart ?? initialWeekStart);
    return `/weekly-close?${params.toString()}`;
  }

  async function handleCloseWeek() {
    setActionError(null);
    setIsClosing(true);

    try {
      const response = await fetch(
        `/api/company-operations/companies/${selectedCompany.id}/weekly-close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart: initialWeekStart, closeNote: closeNote.trim() || undefined })
        }
      );

      const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };

      if (!response.ok) {
        setActionError(
          typeof payload.message === "string"
            ? payload.message
            : Array.isArray(payload.message)
              ? payload.message.join(" ")
              : "Unable to close the workweek."
        );
        return;
      }

      setShowCloseConfirm(false);
      router.refresh();
    } finally {
      setIsClosing(false);
    }
  }

  async function handleReopenWeek() {
    const validationError = validateReopenReason(reopenReason);
    if (validationError) {
      setActionError(validationError);
      return;
    }

    if (!summary.weeklyPeriodId) {
      setActionError("Weekly period is missing.");
      return;
    }

    setActionError(null);
    setIsReopening(true);

    try {
      const response = await fetch(
        `/api/company-operations/weekly-periods/${summary.weeklyPeriodId}/reopen`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reopenReason.trim() })
        }
      );

      const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };

      if (!response.ok) {
        setActionError(
          typeof payload.message === "string"
            ? payload.message
            : Array.isArray(payload.message)
              ? payload.message.join(" ")
              : "Unable to reopen the workweek."
        );
        return;
      }

      setShowReopenConfirm(false);
      setReopenReason("");
      router.refresh();
    } finally {
      setIsReopening(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        {WEEKLY_CLOSE_DISCLAIMER}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {companies.map((company) => (
          <Link
            key={company.id}
            href={buildHref({ companyId: company.id })}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              company.id === selectedCompany.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {company.name}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={buildHref({ weekStart: previousWeekStart })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          Previous week
        </Link>
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900">
          {formatWeekRange(summary.weekStartLocalDate, summary.weekEndLocalDate)}
        </span>
        <Link href={buildHref({ weekStart: nextWeekStart })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          Next week
        </Link>
        <Link href={buildHref({ weekStart: getMondayWeekStart() })} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          This week
        </Link>
        <span className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${weeklyStatusBadgeClass(summary.status)}`}>
          {weeklyStatusLabel(summary.status)}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Target pay date" value={summary.targetPayDate} />
        <SummaryCard label="Approved shifts" value={String(summary.totals.approvedShiftCount)} />
        <SummaryCard label="Blockers" value={String(summary.blockers.length)} highlight={summary.blockers.length > 0} />
        <SummaryCard label="Payable hours" value={formatPayableHours(summary.totals.payableMinutes)} />
        <SummaryCard
          label="Employee gross estimate"
          value={formatEstimateAmount(summary.totals.employeeGrossEstimateMinor, summary.totals.currencyCode)}
        />
        <SummaryCard
          label="Client labor estimate"
          value={formatEstimateAmount(summary.totals.clientLaborEstimateMinor, summary.totals.currencyCode)}
        />
        <SummaryCard
          label="Gross margin estimate"
          value={formatEstimateAmount(summary.totals.grossMarginEstimateMinor, summary.totals.currencyCode)}
        />
        <SummaryCard
          label="Locations included"
          value={summary.locationsIncluded.length > 0 ? String(summary.locationsIncluded.length) : "None"}
        />
      </div>

      <p className="text-xs text-slate-500">{ESTIMATES_DISCLAIMER}</p>

      {summary.blockers.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Blockers before close</h2>
          <p className="mt-1 text-sm text-amber-800">
            Resolve these issues in Review or Corrections before closing the company week.
          </p>
          <div className="mt-4 space-y-4">
            {blockerGroups.map((group) => (
              <div key={group.code}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                  {blockerTypeLabel(group.code)} ({group.items.length})
                </h3>
                <ul className="mt-2 space-y-2">
                  {group.items.map((blocker, index) => (
                    <li key={`${blocker.code}-${blocker.shiftId ?? blocker.correctionId ?? index}`} className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-slate-700">
                      <p>{blocker.message}</p>
                      {(blocker.employeeName || blocker.locationName) && (
                        <p className="mt-1 text-xs text-slate-500">
                          {[blocker.employeeName, blocker.locationName].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <Link
                        href={blockerReviewHref(blocker, selectedCompany.id, initialWeekStart)}
                        className="mt-2 inline-block text-xs font-medium text-slate-900 underline"
                      >
                        Open in {blocker.code === "pending_correction" ? "Corrections" : "Review"}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          No blockers detected for this workweek.
        </section>
      )}

      {(summary.latestSnapshot || summary.reopenedAt) && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Close snapshot</h2>
          {summary.latestSnapshot ? (
            <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-slate-500">Version</dt>
                <dd className="font-medium text-slate-900">v{summary.latestSnapshot.version}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Closed by</dt>
                <dd className="font-medium text-slate-900">{summary.closedBy?.label ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Closed at</dt>
                <dd className="font-medium text-slate-900">{summary.closedAt ? new Date(summary.closedAt).toLocaleString() : "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Approved shifts</dt>
                <dd className="font-medium text-slate-900">{summary.latestSnapshot.approvedShiftCount}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Payable minutes</dt>
                <dd className="font-medium text-slate-900">{summary.latestSnapshot.payableMinutes}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Employee gross estimate</dt>
                <dd className="font-medium text-slate-900">
                  {formatEstimateAmount(summary.latestSnapshot.employeeGrossEstimateMinor, summary.totals.currencyCode)}
                </dd>
              </div>
            </dl>
          ) : null}

          {summary.reopenedAt ? (
            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                Reopened by {summary.reopenedBy?.label ?? "unknown"} on{" "}
                {new Date(summary.reopenedAt).toLocaleString()}.
              </p>
              {summary.reopenReason ? <p className="mt-1">Reason: {summary.reopenReason}</p> : null}
            </div>
          ) : null}

          {summary.snapshotHistory.length > 1 ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Snapshot history</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {summary.snapshotHistory.map((snapshot) => (
                  <li key={snapshot.id}>
                    v{snapshot.version} · {snapshot.approvedShiftCount} shifts ·{" "}
                    {formatEstimateAmount(snapshot.employeeGrossEstimateMinor, summary.totals.currencyCode)} employee estimate
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      {actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {summary.canClose ? (
          <button
            type="button"
            onClick={() => setShowCloseConfirm(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Close week
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
          >
            Close week
          </button>
        )}

        {summary.canReopen ? (
          <button
            type="button"
            onClick={() => setShowReopenConfirm(true)}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900"
          >
            Reopen week
          </button>
        ) : null}
      </div>

      {showCloseConfirm ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Confirm weekly close</h3>
          <p className="mt-2 text-sm text-slate-600">
            Closing freezes approved time and rate snapshots for this workweek. You must reopen the week before making
            further approval or correction changes.
          </p>
          <label className="mt-4 block text-sm text-slate-700">
            Optional close note
            <textarea
              value={closeNote}
              onChange={(event) => setCloseNote(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={2}
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleCloseWeek}
              disabled={isClosing}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isClosing ? "Closing…" : "Confirm close"}
            </button>
            <button
              type="button"
              onClick={() => setShowCloseConfirm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {showReopenConfirm ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Confirm weekly reopen</h3>
          <p className="mt-2 text-sm text-amber-800">
            Reopening is audited and allows correction and review updates. A new close is required to create the next
            immutable snapshot version.
          </p>
          <label className="mt-4 block text-sm text-amber-900">
            Reopen reason (required)
            <textarea
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
              className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900"
              rows={3}
              placeholder="Explain why this closed week must be reopened."
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleReopenWeek}
              disabled={isReopening}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isReopening ? "Reopening…" : "Confirm reopen"}
            </button>
            <button
              type="button"
              onClick={() => setShowReopenConfirm(false)}
              className="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight = false
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
