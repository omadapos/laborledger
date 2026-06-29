"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  canCreateVehicleIntake,
  canDecodeVin,
  filterLocationsForClient,
  formatVinDecodeSourceLabel,
  formatVinDecodeSummary,
  parseOptionalMileageInput,
  validateVin,
  vehicleCreatePrerequisiteMessage,
  vehicleIntakeDisclaimer,
  vinDecodeErrorCopy,
  vinDecodePreviewLoadingCopy,
  type LocationRecord,
  type ServiceClientRecord,
  type VinDecodePreviewRecord
} from "../lib/vehicle-utils";

type CreateVehicleFormProps = {
  readonly companyId: string;
  readonly serviceClients: ServiceClientRecord[];
  readonly locations: LocationRecord[];
};

export function CreateVehicleForm({ companyId, serviceClients, locations }: CreateVehicleFormProps) {
  const router = useRouter();
  const activeClients = serviceClients.filter((client) => !client.archivedAt);
  const defaultClientId = activeClients[0]?.id ?? "";

  const [isOpen, setIsOpen] = useState(false);
  const [vin, setVin] = useState("");
  const [serviceClientId, setServiceClientId] = useState(defaultClientId);
  const [locationId, setLocationId] = useState("");
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    vin?: string;
    serviceClientId?: string;
    locationId?: string;
    mileage?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decodePreview, setDecodePreview] = useState<VinDecodePreviewRecord | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  const clientLocations = useMemo(
    () => filterLocationsForClient(locations, serviceClientId),
    [locations, serviceClientId]
  );

  const prerequisiteMessage = useMemo(
    () => vehicleCreatePrerequisiteMessage(serviceClients, locations),
    [serviceClients, locations]
  );
  const canCreate = canCreateVehicleIntake(serviceClients, locations);

  const vinIsValid = canDecodeVin(vin);

  useEffect(() => {
    if (!clientLocations.some((location) => location.id === locationId)) {
      setLocationId(clientLocations[0]?.id ?? "");
    }
  }, [clientLocations, locationId]);

  useEffect(() => {
    if (!isOpen || !vinIsValid) {
      setDecodePreview(null);
      setDecodeError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void decodeVinPreview(vin);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [isOpen, vin, vinIsValid]);

  function resetForm() {
    setVin("");
    setServiceClientId(defaultClientId);
    setLocationId("");
    setPlate("");
    setColor("");
    setMileage("");
    setNotes("");
    setFieldErrors({});
    setSubmitError(null);
    setDecodePreview(null);
    setDecodeError(null);
  }

  function handleToggle() {
    if (!canCreate && !isOpen) {
      return;
    }

    setIsOpen((open) => {
      if (open) {
        resetForm();
        setSuccessMessage(null);
      }

      return !open;
    });
  }

  async function decodeVinPreview(nextVin: string) {
    if (!canDecodeVin(nextVin)) {
      return;
    }

    setIsDecoding(true);
    setDecodeError(null);

    const response = await fetch("/api/company-operations/vehicles/decode-vin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vin: nextVin.trim() })
    });

    const payload = (await response.json().catch(() => ({}))) as VinDecodePreviewRecord & {
      message?: string;
    };

    setIsDecoding(false);

    if (!response.ok) {
      setDecodePreview(null);
      setDecodeError(vinDecodeErrorCopy(payload.message));
      return;
    }

    setDecodePreview(payload);
    if (payload.warnings?.length) {
      setDecodeError(payload.warnings.join(" "));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const vinError = validateVin(vin);
    const mileageResult = parseOptionalMileageInput(mileage);
    const mileageError = "error" in mileageResult ? mileageResult.error : undefined;

    const nextFieldErrors: typeof fieldErrors = {};
    if (vinError) nextFieldErrors.vin = vinError;
    if (!serviceClientId) nextFieldErrors.serviceClientId = "Service client is required.";
    if (!locationId) nextFieldErrors.locationId = "Location is required.";
    if (mileageError) nextFieldErrors.mileage = mileageError;

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/companies/${companyId}/vehicles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vin: vin.trim(),
        serviceClientId,
        locationId,
        plate: plate.trim() || undefined,
        color: color.trim() || undefined,
        mileage: mileageResult.mileage,
        notes: notes.trim() || undefined
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      vehicle?: { vin?: string };
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to create vehicle.");
      return;
    }

    const createdVin = payload.vehicle?.vin ?? vin.trim().toUpperCase();
    setSuccessMessage(`Vehicle ${createdVin} was added.`);
    resetForm();
    setIsOpen(false);
    router.refresh();
  }

  if (!canCreate) {
    const setupHref = activeClients.length === 0 ? "/service-clients" : "/locations";
    const setupLabel = activeClients.length === 0 ? "Go to Service Clients" : "Go to Locations";

    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-white"
          title={prerequisiteMessage ?? undefined}
        >
          Create vehicle
        </button>
        <p className="max-w-md text-sm text-amber-900">
          {prerequisiteMessage}{" "}
          <Link href={setupHref} className="font-medium underline underline-offset-2">
            {setupLabel}
          </Link>
        </p>
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
        {isOpen ? "Cancel" : "Create vehicle"}
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
          <h2 className="text-sm font-semibold text-slate-900">New vehicle intake</h2>
          <p className="mt-1 text-sm text-slate-500">{vehicleIntakeDisclaimer()}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle-vin">
                VIN
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  id="vehicle-vin"
                  type="text"
                  value={vin}
                  onChange={(event) => setVin(event.target.value.toUpperCase())}
                  maxLength={17}
                  className="min-w-[16rem] flex-1 rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono uppercase text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="17-character VIN"
                  autoComplete="off"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => decodeVinPreview(vin)}
                  disabled={!vinIsValid || isSubmitting || isDecoding}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDecoding ? "Decoding…" : "Decode VIN"}
                </button>
              </div>
              {fieldErrors.vin ? <p className="mt-1.5 text-sm text-red-600">{fieldErrors.vin}</p> : null}
              {isDecoding ? (
                <p className="mt-2 text-sm text-slate-600">{vinDecodePreviewLoadingCopy()}</p>
              ) : null}
              {decodePreview ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">{formatVinDecodeSummary(decodePreview)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Source: {formatVinDecodeSourceLabel(decodePreview.decodeSource)} · preview only; the server
                    re-decodes on create.
                  </p>
                </div>
              ) : null}
              {decodeError ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {decodeError}
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle-service-client">
                Service client
              </label>
              <select
                id="vehicle-service-client"
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

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle-location">
                Location
              </label>
              <select
                id="vehicle-location"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                disabled={isSubmitting || clientLocations.length === 0}
              >
                {clientLocations.length === 0 ? (
                  <option value="">No active locations for this client</option>
                ) : (
                  clientLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))
                )}
              </select>
              {fieldErrors.locationId ? (
                <p className="mt-1.5 text-sm text-red-600">{fieldErrors.locationId}</p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle-plate">
                Plate
              </label>
              <input
                id="vehicle-plate"
                type="text"
                value={plate}
                onChange={(event) => setPlate(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Optional"
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle-color">
                Color
              </label>
              <input
                id="vehicle-color"
                type="text"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Optional"
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle-mileage">
                Mileage
              </label>
              <input
                id="vehicle-mileage"
                type="text"
                inputMode="numeric"
                value={mileage}
                onChange={(event) => setMileage(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Optional"
                autoComplete="off"
                disabled={isSubmitting}
              />
              {fieldErrors.mileage ? <p className="mt-1.5 text-sm text-red-600">{fieldErrors.mileage}</p> : null}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle-notes">
                Notes
              </label>
              <textarea
                id="vehicle-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Optional intake notes"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {submitError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting || clientLocations.length === 0}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Creating…" : "Create vehicle"}
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
