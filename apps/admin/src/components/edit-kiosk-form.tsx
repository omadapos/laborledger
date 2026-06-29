"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { validateKioskName } from "../lib/kiosk-utils";

type EditKioskFormProps = {
  readonly kioskId: string;
  readonly initialName: string;
  readonly disabled?: boolean;
};

export function EditKioskForm({ kioskId, initialName, disabled = false }: EditKioskFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const nameError = validateKioskName(name);
    if (nameError) {
      setFieldError(nameError);
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/kiosks/${kioskId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to update kiosk.");
      return;
    }

    setSuccessMessage("Kiosk name updated.");
    setIsOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          setName(initialName);
          setFieldError(null);
          setSubmitError(null);
        }}
        disabled={disabled}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isOpen ? "Cancel edit" : "Edit name"}
      </button>

      {successMessage && !isOpen ? <p className="text-xs text-emerald-700">{successMessage}</p> : null}

      {isOpen ? (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-kiosk-${kioskId}`}>
            Kiosk name
          </label>
          <input
            id={`edit-kiosk-${kioskId}`}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            disabled={isSubmitting}
          />
          {fieldError ? <p className="mt-1 text-xs text-red-600">{fieldError}</p> : null}
          {submitError ? <p className="mt-1 text-xs text-red-600">{submitError}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-3 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Saving…" : "Save name"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
