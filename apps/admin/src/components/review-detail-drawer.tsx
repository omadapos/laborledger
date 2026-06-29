"use client";

import {
  ESTIMATES_DISCLAIMER,
  formatReviewAmount,
  formatReviewClockRange,
  formatReviewDate,
  formatReviewMinutes,
  punchActionLabel,
  reviewStatusLabel,
  warningBadgeLabel,
  type ReviewShiftRecord
} from "../lib/review-utils";
import { formatShiftTimeRange } from "../lib/shift-utils";

type ReviewDetailDrawerProps = {
  readonly shift: ReviewShiftRecord | null;
  readonly companyName: string;
  readonly onClose: () => void;
  readonly onApproveShift: (shiftId: string) => Promise<void>;
  readonly onApproveAdditionalTime: (shiftId: string) => Promise<void>;
  readonly busyShiftId: string | null;
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

export function ReviewDetailDrawer({
  shift,
  companyName,
  onClose,
  onApproveShift,
  onApproveAdditionalTime,
  busyShiftId
}: ReviewDetailDrawerProps) {
  if (!shift) {
    return null;
  }

  const timeZone = shift.location.timezone;
  const isBusy = busyShiftId === shift.shiftId;

  return (
    <>
      <button
        type="button"
        aria-label="Close review detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl shadow-slate-300/30"
        role="dialog"
        aria-labelledby="review-detail-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="review-detail-title" className="truncate text-base font-semibold text-slate-900">
              {shift.employee.fullName}
            </h2>
            <p className="text-xs text-slate-500">
              {companyName} · {shift.location.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
              {reviewStatusLabel(shift.displayStatus)}
            </span>
            <span className="text-xs text-slate-500">{formatReviewDate(shift.scheduledStartUtc, timeZone)}</span>
          </div>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Scheduled shift</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
              <p>{shift.serviceClient.name}</p>
              <p className="mt-1">
                {formatShiftTimeRange(shift.scheduledStartUtc, shift.scheduledEndUtc, timeZone)}
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Punch timeline</h3>
            {shift.punchTimeline && shift.punchTimeline.length > 0 ? (
              <ol className="space-y-2">
                {shift.punchTimeline.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{punchActionLabel(event.action)}</span>
                      <span className="text-xs text-slate-500">
                        {formatShiftTimeRange(event.eventUtc, event.eventUtc, timeZone)}
                      </span>
                    </div>
                    {event.isEarly ? <p className="mt-1 text-xs text-yellow-700">Early clock-in flagged</p> : null}
                    {event.isLate ? <p className="mt-1 text-xs text-yellow-700">Late clock-in flagged</p> : null}
                    {event.breakMinutes !== null ? (
                      <p className="mt-1 text-xs text-slate-500">Break duration: {event.breakMinutes} min</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">No punch events recorded.</p>
            )}
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Worked time</h3>
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Actual time</dt>
                <dd className="font-medium text-slate-900">
                  {formatReviewClockRange(shift.clockInUtc, shift.clockOutUtc, timeZone)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Break</dt>
                <dd className="font-medium text-slate-900">{formatReviewMinutes(shift.breakDurationMinutes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Worked minutes</dt>
                <dd className="font-medium text-slate-900">{formatReviewMinutes(shift.workedMinutes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Additional minutes</dt>
                <dd className="font-medium text-slate-900">{formatReviewMinutes(shift.additionalMinutes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Payable minutes</dt>
                <dd className="font-medium text-slate-900">{formatReviewMinutes(shift.payableMinutes)}</dd>
              </div>
            </dl>
          </section>

          {shift.warnings.length > 0 ? (
            <section className="mt-6 space-y-3">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Warnings</h3>
              <div className="flex flex-wrap gap-2">
                {shift.warnings.map((warning) => (
                  <WarningBadge key={warning.code} code={warning.code} />
                ))}
              </div>
              <ul className="space-y-1 text-sm text-slate-600">
                {shift.warnings.map((warning) => (
                  <li key={`${warning.code}-message`}>{warning.message}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Internal estimates</h3>
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Employee estimate</dt>
                <dd className="font-medium text-slate-900">
                  {formatReviewAmount(shift.estimatedEmployeeAmountMinor, shift.currencyCode)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Client estimate</dt>
                <dd className="font-medium text-slate-900">
                  {formatReviewAmount(shift.estimatedClientAmountMinor, shift.currencyCode)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-slate-500">{ESTIMATES_DISCLAIMER}</p>
          </section>
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {shift.canApproveAdditionalTime ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onApproveAdditionalTime(shift.shiftId)}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              >
                Approve additional time
              </button>
            ) : null}
            {shift.canApproveShift ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onApproveShift(shift.shiftId)}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Approve shift
              </button>
            ) : null}
          </div>
          {!shift.canApproveShift && shift.approvalBlockReasons.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">{shift.approvalBlockReasons[0]}</p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
