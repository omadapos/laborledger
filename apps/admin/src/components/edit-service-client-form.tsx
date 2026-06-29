"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { validateServiceClientName } from "../lib/service-client-utils";

type EditServiceClientFormProps = {
  readonly serviceClientId: string;
  readonly initialName: string;
  readonly onSaved?: () => void;
};

export function EditServiceClientForm({
  serviceClientId,
  initialName,
  onSaved
}: EditServiceClientFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleCancel() {
    setName(initialName);
    setFieldErrors({});
    setSubmitError(null);
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const nameError = validateServiceClientName(name);
    if (nameError) {
      setFieldErrors({ name: nameError });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/service-clients/${serviceClientId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      serviceClient?: { name?: string };
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to update service client.");
      return;
    }

    const updatedName = payload.serviceClient?.name ?? name.trim();
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
          setName(initialName);
          setFieldErrors({});
          setSubmitError(null);
          setSuccessMessage(null);
          setIsEditing(true);
        }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        Edit
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-service-client-name-${serviceClientId}`}>
          Name
        </label>
        <input
          id={`edit-service-client-name-${serviceClientId}`}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          disabled={isSubmitting}
        />
        {fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
      </div>

      {submitError ? <p className="text-xs text-red-600">{submitError}</p> : null}
      {successMessage ? <p className="text-xs text-emerald-700">{successMessage}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
