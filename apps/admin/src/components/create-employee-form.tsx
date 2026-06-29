"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  DEFAULT_HOURLY_RATE_USD,
  generateEmployeePin,
  validateEmployeeFullName,
  validateEmployeePin
} from "../lib/employee-utils";

type CreateEmployeeFormProps = {
  readonly companyId: string;
  readonly onCreated?: () => void;
};

export function CreateEmployeeForm({ companyId, onCreated }: CreateEmployeeFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [pin, setPin] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; pin?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setFullName("");
    setPin("");
    setFieldErrors({});
    setSubmitError(null);
    setRevealedPin(null);
  }

  function handleToggle() {
    setIsOpen((open) => {
      if (open) {
        resetForm();
        setSuccessMessage(null);
      }

      return !open;
    });
  }

  function handleGeneratePin() {
    const generated = generateEmployeePin();
    setPin(generated);
    setRevealedPin(generated);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.pin;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);
    setRevealedPin(null);

    const nextFieldErrors: { fullName?: string; pin?: string } = {};
    const fullNameError = validateEmployeeFullName(fullName);
    const pinError = validateEmployeePin(pin);

    if (fullNameError) {
      nextFieldErrors.fullName = fullNameError;
    }

    if (pinError) {
      nextFieldErrors.pin = pinError;
    }

    if (fullNameError || pinError) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const submittedPin = pin;

    const response = await fetch(`/api/company-operations/companies/${companyId}/employees`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        fullName: fullName.trim(),
        pin: submittedPin
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      employee?: { fullName?: string };
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to create employee.");
      return;
    }

    const createdName = payload.employee?.fullName ?? fullName.trim();
    setSuccessMessage(`${createdName} was created. Save the kiosk PIN below — it will not be shown again.`);
    setRevealedPin(submittedPin);
    resetForm();
    setIsOpen(false);
    onCreated?.();
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        {isOpen ? "Cancel" : "Create employee"}
      </button>

      {successMessage ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p>{successMessage}</p>
          {revealedPin ? (
            <p className="mt-2 font-mono text-base font-semibold tracking-widest text-emerald-950">{revealedPin}</p>
          ) : null}
        </div>
      ) : null}

      {isOpen ? (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30"
        >
          <h2 className="text-sm font-semibold text-slate-900">New employee</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add someone to this company. Default pay rate is USD {DEFAULT_HOURLY_RATE_USD}/hour.
          </p>

          <div className="mt-6 space-y-6">
            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Personal information</h3>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700" htmlFor="employee-full-name">
                  Full name
                </label>
                <input
                  id="employee-full-name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="Jane Smith"
                  autoComplete="name"
                  disabled={isSubmitting}
                />
                {fieldErrors.fullName ? (
                  <p className="mt-1.5 text-sm text-red-600">{fieldErrors.fullName}</p>
                ) : null}
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Kiosk access</h3>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700" htmlFor="employee-pin">
                  6-digit PIN
                </label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="employee-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(event) => {
                      setPin(event.target.value.replace(/\D/gu, "").slice(0, 6));
                      setRevealedPin(null);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    placeholder="000000"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePin}
                    disabled={isSubmitting}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed"
                  >
                    Generate PIN
                  </button>
                </div>
                {fieldErrors.pin ? <p className="mt-1.5 text-sm text-red-600">{fieldErrors.pin}</p> : null}
                <p className="mt-1.5 text-xs text-slate-500">PINs are stored securely and never shown again after you close this notice.</p>
              </div>
            </section>
          </div>

          {submitError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Creating…" : "Create employee"}
            </button>
            <button
              type="button"
              onClick={handleToggle}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
