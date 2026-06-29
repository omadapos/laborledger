"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  COMMON_IANA_TIMEZONES,
  validateLocationName,
  validateLocationTimeZone,
  validateServiceClientId,
  type ServiceClientRecord
} from "../lib/location-utils";

type EditLocationFormProps = {
  readonly locationId: string;
  readonly initialName: string;
  readonly initialTimezone: string;
  readonly initialServiceClientId: string;
  readonly serviceClients: ServiceClientRecord[];
  readonly onSaved?: () => void;
};

export function EditLocationForm({
  locationId,
  initialName,
  initialTimezone,
  initialServiceClientId,
  serviceClients,
  onSaved
}: EditLocationFormProps) {
  const router = useRouter();
  const activeClients = serviceClients.filter((client) => !client.archivedAt);
  const presetTimezone = (COMMON_IANA_TIMEZONES as readonly string[]).includes(initialTimezone);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(presetTimezone ? initialTimezone : "America/New_York");
  const [customTimezone, setCustomTimezone] = useState(presetTimezone ? "" : initialTimezone);
  const [useCustomTimezone, setUseCustomTimezone] = useState(!presetTimezone);
  const [serviceClientId, setServiceClientId] = useState(initialServiceClientId);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    timezone?: string;
    serviceClientId?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedTimezone = useCustomTimezone ? customTimezone.trim() : timezone;

  function handleCancel() {
    setName(initialName);
    setTimezone(presetTimezone ? initialTimezone : "America/New_York");
    setCustomTimezone(presetTimezone ? "" : initialTimezone);
    setUseCustomTimezone(!presetTimezone);
    setServiceClientId(initialServiceClientId);
    setFieldErrors({});
    setSubmitError(null);
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const nextFieldErrors: {
      name?: string;
      timezone?: string;
      serviceClientId?: string;
    } = {};
    const nameError = validateLocationName(name);
    const timezoneError = validateLocationTimeZone(resolvedTimezone);
    const clientError = validateServiceClientId(serviceClientId);

    if (nameError) nextFieldErrors.name = nameError;
    if (timezoneError) nextFieldErrors.timezone = timezoneError;
    if (clientError) nextFieldErrors.serviceClientId = clientError;

    if (nameError || timezoneError || clientError) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/locations/${locationId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        timezone: resolvedTimezone,
        serviceClientId
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      location?: { name?: string };
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to update location.");
      return;
    }

    const updatedName = payload.location?.name ?? name.trim();
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
        <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-location-name-${locationId}`}>
          Name
        </label>
        <input
          id={`edit-location-name-${locationId}`}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          disabled={isSubmitting}
        />
        {fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-location-client-${locationId}`}>
          Service client
        </label>
        <select
          id={`edit-location-client-${locationId}`}
          value={serviceClientId}
          onChange={(event) => setServiceClientId(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          disabled={isSubmitting}
        >
          {activeClients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {fieldErrors.serviceClientId ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.serviceClientId}</p>
        ) : null}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-location-timezone-${locationId}`}>
          Time zone (IANA)
        </label>
        {!useCustomTimezone ? (
          <select
            id={`edit-location-timezone-${locationId}`}
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            disabled={isSubmitting}
          >
            {COMMON_IANA_TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`edit-location-timezone-custom-${locationId}`}
            type="text"
            value={customTimezone}
            onChange={(event) => setCustomTimezone(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            disabled={isSubmitting}
          />
        )}
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={useCustomTimezone}
            onChange={(event) => setUseCustomTimezone(event.target.checked)}
            disabled={isSubmitting}
          />
          Custom IANA time zone
        </label>
        {fieldErrors.timezone ? <p className="mt-1 text-xs text-red-600">{fieldErrors.timezone}</p> : null}
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
