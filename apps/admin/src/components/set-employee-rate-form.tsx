"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  DEFAULT_HOURLY_RATE_USD,
  hourlyRateToMinorUnits,
  validateHourlyRateInput
} from "../lib/employee-utils";

type SetEmployeeRateFormProps = {
  readonly employeeId: string;
  readonly disabled?: boolean;
  readonly onRateSet?: () => void;
};

export function SetEmployeeRateForm({ employeeId, disabled = false, onRateSet }: SetEmployeeRateFormProps) {
  const router = useRouter();
  const [hourlyRate, setHourlyRate] = useState(String(DEFAULT_HOURLY_RATE_USD));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const rateError = validateHourlyRateInput(hourlyRate);
    if (rateError) {
      setFieldError(rateError);
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/employees/${employeeId}/rates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rateMinorUnits: hourlyRateToMinorUnits(hourlyRate),
        effectiveStart: new Date().toISOString()
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to update pay rate.");
      return;
    }

    setSuccessMessage("Pay rate updated with today as the effective start date.");
    onRateSet?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t border-slate-200 pt-4">
      <label className="block text-xs font-medium text-slate-700" htmlFor={`employee-rate-${employeeId}`}>
        Override hourly rate (USD)
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id={`employee-rate-${employeeId}`}
          type="number"
          min="0.01"
          step="0.01"
          value={hourlyRate}
          onChange={(event) => setHourlyRate(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          disabled={disabled || isSubmitting}
        />
        <button
          type="submit"
          disabled={disabled || isSubmitting}
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "Saving…" : "Set rate"}
        </button>
      </div>
      {fieldError ? <p className="mt-1.5 text-xs text-red-600">{fieldError}</p> : null}
      {submitError ? <p className="mt-1.5 text-xs text-red-600">{submitError}</p> : null}
      {successMessage ? <p className="mt-1.5 text-xs text-emerald-700">{successMessage}</p> : null}
    </form>
  );
}
