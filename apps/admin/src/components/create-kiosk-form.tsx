"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { KioskSetupInstructions } from "./kiosk-setup-instructions";
import {
  validateKioskLocationId,
  validateKioskName,
  type KioskRecord,
  type LocationOption
} from "../lib/kiosk-utils";

type CreateKioskFormProps = {
  readonly companyId: string;
  readonly availableLocations: LocationOption[];
  readonly apiUrl: string;
};

export function CreateKioskForm({ companyId, availableLocations, apiUrl }: CreateKioskFormProps) {
  const router = useRouter();
  const defaultLocationId = availableLocations[0]?.id ?? "";

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; locationId?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKiosk, setCreatedKiosk] = useState<{
    kiosk: KioskRecord;
    kioskSecret: string;
  } | null>(null);

  function resetForm() {
    setName("");
    setLocationId(defaultLocationId);
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleToggle() {
    setIsOpen((open) => {
      if (open) {
        resetForm();
      }

      return !open;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const nextFieldErrors: { name?: string; locationId?: string } = {};
    const nameError = validateKioskName(name);
    const locationError = validateKioskLocationId(locationId);

    if (nameError) nextFieldErrors.name = nameError;
    if (locationError) nextFieldErrors.locationId = locationError;

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/companies/${companyId}/kiosks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), locationId })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      kiosk?: KioskRecord;
      kioskSecret?: string;
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to create kiosk.");
      return;
    }

    if (payload.kiosk && payload.kioskSecret) {
      setCreatedKiosk({ kiosk: payload.kiosk, kioskSecret: payload.kioskSecret });
    }

    resetForm();
    setIsOpen(false);
    router.refresh();
  }

  const noLocationsAvailable = availableLocations.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          disabled={noLocationsAvailable}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isOpen ? "Cancel" : "Create kiosk"}
        </button>
        {noLocationsAvailable ? (
          <p className="text-sm text-slate-500">
            Every active location already has a kiosk, or no active locations exist.
          </p>
        ) : null}
      </div>

      {createdKiosk ? (
        <KioskSetupInstructions
          kiosk={createdKiosk.kiosk}
          kioskSecret={createdKiosk.kioskSecret}
          apiUrl={apiUrl}
          title={`New kiosk: ${createdKiosk.kiosk.name}`}
        />
      ) : null}

      {isOpen ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40"
        >
          <h3 className="text-sm font-semibold text-slate-900">Create kiosk</h3>
          <p className="mt-1 text-xs text-slate-500">
            Each location can have one kiosk. A pairing secret is generated automatically.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700" htmlFor="kiosk-name">
                Kiosk name
              </label>
              <input
                id="kiosk-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Front desk kiosk"
                disabled={isSubmitting}
              />
              {fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700" htmlFor="kiosk-location">
                Location
              </label>
              <select
                id="kiosk-location"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                disabled={isSubmitting}
              >
                {availableLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              {fieldErrors.locationId ? (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.locationId}</p>
              ) : null}
            </div>
          </div>

          {submitError ? <p className="mt-3 text-sm text-red-600">{submitError}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Creating…" : "Create kiosk"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
