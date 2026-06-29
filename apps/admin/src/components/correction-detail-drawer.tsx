"use client";

import { useState } from "react";

import {
  CORRECTIONS_DISCLAIMER,
  correctionStatusLabel,
  formatCorrectionPayload,
  formatWorkedMinuteImpact,
  type CorrectionDetail
} from "../lib/correction-utils";

type CorrectionDetailDrawerProps = {
  readonly correction: CorrectionDetail | null;
  readonly onClose: () => void;
  readonly onChanged: () => void;
};

export function CorrectionDetailDrawer({ correction, onClose, onChanged }: CorrectionDetailDrawerProps) {
  const [busy, setBusy] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!correction) {
    return null;
  }

  const timeZone = correction.location.timezone;

  async function postAction(path: string, body?: Record<string, string>) {
    setBusy(true);
    setError(null);

    const init: RequestInit = { method: "POST" };
    if (body) {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify(body);
    }

    const response = await fetch(path, init);

    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      setError(payload.message ?? "Action failed.");
      setBusy(false);
      return;
    }

    setBusy(false);
    onChanged();
  }

  return (
    <>
      <button type="button" aria-label="Close correction detail" className="fixed inset-0 z-40 bg-slate-900/20" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{correction.typeLabel}</h2>
            <p className="text-xs text-slate-500">{correction.employee.fullName} · {correction.location.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs">Close</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium">
              {correctionStatusLabel(correction.status)}
            </span>
          </div>

          <section>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Reason</h3>
            <p className="mt-2 text-sm text-slate-700">{correction.reason}</p>
          </section>

          <section>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Original timeline</h3>
            <ul className="mt-2 space-y-2">
              {correction.originalTimeline.map((event) => (
                <li key={event.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{event.action}</span>
                    <span className="text-xs text-slate-500">{event.source}</span>
                  </div>
                  <p className="text-xs text-slate-500">{event.eventUtc}</p>
                  {event.originalEventUtc ? (
                    <p className="text-xs text-amber-700">Original kiosk time: {event.originalEventUtc}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Original</h3>
              <p className="mt-2 text-sm">{formatCorrectionPayload(correction.originalPayload, timeZone)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Proposed</h3>
              <p className="mt-2 text-sm">{formatCorrectionPayload(correction.proposedPayload, timeZone)}</p>
            </div>
          </section>

          {correction.finalPayload ? (
            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Applied final values</h3>
              <p className="mt-2 text-sm">{formatCorrectionPayload(correction.finalPayload, timeZone)}</p>
            </section>
          ) : null}

          <section>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Worked-minute impact</h3>
            <p className="mt-2 text-sm">{formatWorkedMinuteImpact(correction.workedMinuteImpact)}</p>
          </section>

          <p className="text-xs text-slate-500">{CORRECTIONS_DISCLAIMER}</p>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="border-t border-slate-200 px-5 py-4 space-y-3">
          {(correction.canReject || correction.canApprove) && (
            <textarea
              value={reviewReason}
              onChange={(event) => setReviewReason(event.target.value)}
              rows={2}
              placeholder="Reviewer comment (required to reject)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {correction.canApprove ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => postAction(`/api/company-operations/corrections/${correction.id}/approve`, { reviewReason })}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Approve
              </button>
            ) : null}
            {correction.canReject ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => postAction(`/api/company-operations/corrections/${correction.id}/reject`, { reviewReason })}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
              >
                Reject
              </button>
            ) : null}
            {correction.canApply ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => postAction(`/api/company-operations/corrections/${correction.id}/apply`)}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 disabled:opacity-60"
              >
                Apply correction
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
