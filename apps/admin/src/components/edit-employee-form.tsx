"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { validateEmployeeFullName } from "../lib/employee-utils";

type EditEmployeeFormProps = {
  readonly employeeId: string;
  readonly initialFullName: string;
  readonly onSaved?: () => void;
};

export function EditEmployeeForm({ employeeId, initialFullName, onSaved }: EditEmployeeFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(initialFullName);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleCancel() {
    setFullName(initialFullName);
    setFieldError(null);
    setSubmitError(null);
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const fullNameError = validateEmployeeFullName(fullName);
    if (fullNameError) {
      setFieldError(fullNameError);
      return;
    }

    const trimmedName = fullName.trim();
    if (trimmedName === initialFullName.trim()) {
      setSuccessMessage("No changes to save.");
      setIsEditing(false);
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/employees/${employeeId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName: trimmedName })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      employee?: { fullName?: string };
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to update employee.");
      return;
    }

    const updatedName = payload.employee?.fullName ?? trimmedName;
    setSuccessMessage(`${updatedName} was updated.`);
    setIsEditing(false);
    onSaved?.();
    router.refresh();
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          setFullName(initialFullName);
          setFieldError(null);
          setSubmitError(null);
          setSuccessMessage(null);
          setIsEditing(true);
        }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        Edit name
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="sr-only" htmlFor={`edit-employee-name-${employeeId}`}>
        Full name
      </label>
      <input
        id={`edit-employee-name-${employeeId}`}
        type="text"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        autoComplete="name"
        disabled={isSubmitting}
      />
      {fieldError ? <p className="text-xs text-red-600">{fieldError}</p> : null}
      {submitError ? <p className="text-xs text-red-600">{submitError}</p> : null}
      {successMessage ? <p className="text-xs text-emerald-700">{successMessage}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
