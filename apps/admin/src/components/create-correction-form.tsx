"use client";

import { useEffect, useState } from "react";

import {
  CORRECTION_TYPE_OPTIONS,
  requiresPunchEventId,
  type CorrectionType
} from "../lib/correction-utils";

type ShiftOption = {
  shiftId: string;
  employeeName: string;
  locationName: string;
  scheduledStartUtc: string;
  punchTimeline?: Array<{ id: string; action: string; eventUtc: string }>;
};

type CreateCorrectionFormProps = {
  readonly companyId: string;
  readonly shiftOptions: ShiftOption[];
};

export function CreateCorrectionForm({ companyId, shiftOptions }: CreateCorrectionFormProps) {
  const [shiftId, setShiftId] = useState(shiftOptions[0]?.shiftId ?? "");
  const [type, setType] = useState<CorrectionType>("MISSING_CLOCK_OUT");
  const [proposedEventUtc, setProposedEventUtc] = useState("");
  const [punchEventId, setPunchEventId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [punchTimeline, setPunchTimeline] = useState<Array<{ id: string; action: string; eventUtc: string }>>([]);

  useEffect(() => {
    if (!shiftId) {
      setPunchTimeline([]);
      return;
    }

    void fetch(`/api/company-operations/shifts/${shiftId}/review`)
      .then(async (response) => {
        if (!response.ok) {
          setPunchTimeline([]);
          return;
        }
        const payload = (await response.json()) as {
          originalPunchTimeline?: Array<{ id: string; action: string; eventUtc: string }>;
        };
        setPunchTimeline(payload.originalPunchTimeline ?? []);
      })
      .catch(() => setPunchTimeline([]));
  }, [shiftId]);

  const punchOptions = punchTimeline.filter((event) => {
      if (type === "INCORRECT_CLOCK_IN") return event.action === "CLOCK_IN";
      if (type === "INCORRECT_CLOCK_OUT") return event.action === "CLOCK_OUT";
      if (type === "INCORRECT_BREAK_START") return event.action === "BREAK_START";
      if (type === "INCORRECT_BREAK_END") return event.action === "BREAK_END";
      return false;
    });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/company-operations/shifts/${shiftId}/corrections`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        reason,
        proposedEventUtc: new Date(proposedEventUtc).toISOString(),
        ...(requiresPunchEventId(type) ? { punchEventId } : {})
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      setError(payload.message ?? "Unable to create correction request.");
      setSubmitting(false);
      return;
    }

    setMessage("Correction request created.");
    setReason("");
    setProposedEventUtc("");
    setPunchEventId("");
    setSubmitting(false);
    window.location.reload();
  }

  if (shiftOptions.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm text-slate-600">
        No punch shifts are available in the selected week. Create kiosk punches first, then request a correction here.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4"
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Create admin correction</h2>
        <p className="mt-1 text-xs text-slate-500">Company {companyId.slice(0, 8)}… · employee self-service requests are not available yet.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="correction-shift">
            Shift
          </label>
          <select
            id="correction-shift"
            value={shiftId}
            onChange={(event) => setShiftId(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
          >
            {shiftOptions.map((option) => (
              <option key={option.shiftId} value={option.shiftId}>
                {option.employeeName} · {option.locationName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="correction-type">
            Type
          </label>
          <select
            id="correction-type"
            value={type}
            onChange={(event) => setType(event.target.value as CorrectionType)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
          >
            {CORRECTION_TYPE_OPTIONS.filter((option) => option.value).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="correction-time">
            Proposed time
          </label>
          <input
            id="correction-time"
            type="datetime-local"
            required
            value={proposedEventUtc}
            onChange={(event) => setProposedEventUtc(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
          />
        </div>

        {requiresPunchEventId(type) ? (
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="correction-punch">
              Original punch event
            </label>
            <select
              id="correction-punch"
              required
              value={punchEventId}
              onChange={(event) => setPunchEventId(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
            >
              <option value="">Select punch event</option>
              {punchOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.action} · {event.eventUtc}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="lg:col-span-2">
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="correction-reason">
            Reason
          </label>
          <textarea
            id="correction-reason"
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
            placeholder="Explain why this correction is needed."
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Create correction request"}
      </button>
    </form>
  );
}
