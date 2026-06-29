"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  formatCopyWeekSummary,
  formatScheduleConflict,
  getMondayWeekStart,
  validateCopyWeekForm,
  type CopyWeekResultRecord
} from "../lib/shift-utils";

type CopyWeekFormProps = {
  readonly companyId: string;
  readonly initialSourceWeekStart: string;
};

export function CopyWeekForm({ companyId, initialSourceWeekStart }: CopyWeekFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [sourceWeekStart, setSourceWeekStart] = useState(initialSourceWeekStart);
  const [targetWeekStart, setTargetWeekStart] = useState(getMondayWeekStart());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CopyWeekResultRecord | null>(null);

  const validationError = useMemo(
    () => validateCopyWeekForm({ sourceWeekStart, targetWeekStart }),
    [sourceWeekStart, targetWeekStart]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setResult(null);

    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/companies/${companyId}/shifts/copy-week`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceWeekStart, targetWeekStart })
    });

    const payload = (await response.json().catch(() => ({}))) as CopyWeekResultRecord & { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to copy week.");
      return;
    }

    setResult(payload);
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Copy week</h2>
          <p className="mt-1 text-sm text-slate-500">
            Copy scheduled shifts to another week preserving local wall-clock times. Conflicts are reported per shift.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {isOpen ? "Hide" : "Copy week"}
        </button>
      </div>

      {isOpen ? (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="copy-source-week">
              Source week (Monday)
            </label>
            <input
              id="copy-source-week"
              type="date"
              value={sourceWeekStart}
              onChange={(event) => setSourceWeekStart(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="copy-target-week">
              Target week (Monday)
            </label>
            <input
              id="copy-target-week"
              type="date"
              value={targetWeekStart}
              onChange={(event) => setTargetWeekStart(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
              disabled={isSubmitting}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {isSubmitting ? "Copying…" : "Copy shifts"}
            </button>
          </div>
        </form>
      ) : null}

      {submitError ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">{formatCopyWeekSummary(result)}</p>
          {result.conflicts.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-slate-600">
              {result.conflicts.map((conflict) => (
                <li key={`${conflict.conflictingShiftId}-${conflict.scheduledStart}`}>
                  {formatScheduleConflict(conflict)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
