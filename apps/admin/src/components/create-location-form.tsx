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

type CreateLocationFormProps = {
  readonly companyId: string;
  readonly serviceClients: ServiceClientRecord[];
};

export function CreateLocationForm({ companyId, serviceClients }: CreateLocationFormProps) {
  const router = useRouter();
  const activeClients = serviceClients.filter((client) => !client.archivedAt);
  const defaultClientId = activeClients[0]?.id ?? "";

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [customTimezone, setCustomTimezone] = useState("");
  const [useCustomTimezone, setUseCustomTimezone] = useState(false);
  const [serviceClientId, setServiceClientId] = useState(defaultClientId);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    timezone?: string;
    serviceClientId?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedTimezone = useCustomTimezone ? customTimezone.trim() : timezone;

  function resetForm() {
    setName("");
    setTimezone("America/New_York");
    setCustomTimezone("");
    setUseCustomTimezone(false);
    setServiceClientId(defaultClientId);
    setFieldErrors({});
    setSubmitError(null);
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

    const response = await fetch(`/api/company-operations/companies/${companyId}/locations`, {
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
      setSubmitError(payload.message ?? "Unable to create location.");
      return;
    }

    const createdName = payload.location?.name ?? name.trim();
    setSuccessMessage(`${createdName} was created successfully.`);
    resetForm();
    setIsOpen(false);
    router.refresh();
  }

  if (activeClients.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Add an active service client for this company before creating locations.
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        {isOpen ? "Cancel" : "Create location"}
      </button>

      {successMessage ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      ) : null}

      {isOpen ? (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30"
        >
          <h2 className="text-sm font-semibold text-slate-900">New location</h2>
          <p className="mt-1 text-sm text-slate-500">
            Locations define where work happens. The time zone drives scheduling, punches, and weekly close for this
            site.
          </p>

          <div className="mt-6 space-y-6">
            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Site details</h3>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700" htmlFor="location-name">
                  Name
                </label>
                <input
                  id="location-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="Downtown HQ"
                  autoComplete="off"
                  disabled={isSubmitting}
                />
                {fieldErrors.name ? <p className="mt-1.5 text-sm text-red-600">{fieldErrors.name}</p> : null}
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company & client</h3>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700" htmlFor="location-service-client">
                  Service client
                </label>
                <select
                  id="location-service-client"
                  value={serviceClientId}
                  onChange={(event) => setServiceClientId(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  disabled={isSubmitting}
                >
                  {activeClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.serviceClientId ? (
                  <p className="mt-1.5 text-sm text-red-600">{fieldErrors.serviceClientId}</p>
                ) : null}
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Time zone</h3>
              <p className="mt-1 text-xs text-slate-500">
                Stored as an IANA identifier. Shifts and weekly periods use this zone — not the browser clock.
              </p>
              <div className="mt-3 space-y-3">
                {!useCustomTimezone ? (
                  <select
                    id="location-timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
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
                    id="location-timezone-custom"
                    type="text"
                    value={customTimezone}
                    onChange={(event) => setCustomTimezone(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    placeholder="America/New_York"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                )}
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={useCustomTimezone}
                    onChange={(event) => setUseCustomTimezone(event.target.checked)}
                    disabled={isSubmitting}
                  />
                  Enter a custom IANA time zone
                </label>
                {fieldErrors.timezone ? (
                  <p className="text-sm text-red-600">{fieldErrors.timezone}</p>
                ) : null}
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
              {isSubmitting ? "Creating…" : "Create location"}
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
