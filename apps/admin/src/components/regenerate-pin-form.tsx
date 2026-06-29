"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { generateEmployeePin, validateEmployeePin } from "../lib/employee-utils";

type RegeneratePinFormProps = {
  readonly employeeId: string;
  readonly employeeName: string;
  readonly disabled?: boolean;
};

export function RegeneratePinForm({ employeeId, employeeName, disabled = false }: RegeneratePinFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleGeneratePin() {
    const generated = generateEmployeePin();
    setPin(generated);
    setFieldError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setRevealedPin(null);

    const pinError = validateEmployeePin(pin);
    if (pinError) {
      setFieldError(pinError);
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    const submittedPin = pin;

    const response = await fetch(`/api/company-operations/employees/${employeeId}/pin/regenerate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: submittedPin })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to reset PIN.");
      return;
    }

    setRevealedPin(submittedPin);
    setPin("");
    setIsOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setIsOpen((open) => !open);
            setSubmitError(null);
            setFieldError(null);
          }}
          disabled={disabled}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isOpen ? "Cancel reset" : "Reset PIN"}
        </button>
        {disabled ? (
          <p className="text-xs text-slate-500">Reactivate this employee before setting a new PIN.</p>
        ) : null}
      </div>

      {revealedPin ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <p className="font-medium">New PIN for {employeeName}</p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-widest">{revealedPin}</p>
          <p className="mt-2 text-xs text-amber-800">Copy this PIN now. It will not be shown again.</p>
        </div>
      ) : null}

      {isOpen ? (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="block text-xs font-medium text-slate-700" htmlFor={`reset-pin-${employeeId}`}>
            New 6-digit PIN
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id={`reset-pin-${employeeId}`}
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/gu, "").slice(0, 6))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              placeholder="000000"
              autoComplete="off"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={handleGeneratePin}
              disabled={isSubmitting}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white/80"
            >
              Generate
            </button>
          </div>
          {fieldError ? <p className="mt-1.5 text-xs text-red-600">{fieldError}</p> : null}
          {submitError ? <p className="mt-1.5 text-xs text-red-600">{submitError}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-3 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Saving…" : "Save new PIN"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
