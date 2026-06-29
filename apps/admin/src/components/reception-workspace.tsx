"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { ServiceCatalogListRecord } from "../lib/service-catalog-utils";
import type { LocationRecord, ServiceClientRecord } from "../lib/location-utils";
import {
  buildReceptionVehiclePayload,
  buildReceptionWorkOrderPayload,
  formatDecodedVehicleSummary,
  RECEPTION_HELPER_COPY,
  validateReceptionForm,
  type ReceptionFormState
} from "../lib/reception-utils";
import { filterActiveCatalogItems, formatWorkOrderMoney } from "../lib/work-order-utils";
import {
  canDecodeVin,
  filterLocationsForClient,
  formatVinDecodeSourceLabel,
  formatVinDecodeSummary,
  vehicleCreatePrerequisiteMessage,
  vinDecodeErrorCopy,
  vinDecodePreviewLoadingCopy,
  type VinDecodePreviewRecord
} from "../lib/vehicle-utils";

type ReceptionWorkspaceProps = {
  readonly companyId: string;
  readonly serviceClients: ServiceClientRecord[];
  readonly locations: LocationRecord[];
  readonly catalogItems: ServiceCatalogListRecord[];
};

export function ReceptionWorkspace({
  companyId,
  serviceClients,
  locations,
  catalogItems
}: ReceptionWorkspaceProps) {
  const router = useRouter();
  const activeClients = useMemo(
    () => serviceClients.filter((client) => !client.archivedAt),
    [serviceClients]
  );
  const activeCatalogItems = useMemo(() => filterActiveCatalogItems(catalogItems), [catalogItems]);
  const defaultClientId = activeClients[0]?.id ?? "";

  const [form, setForm] = useState<ReceptionFormState>({
    serviceClientId: defaultClientId,
    locationId: "",
    vin: "",
    plate: "",
    color: "",
    notes: "",
    selectedCatalogIds: [],
    workOrderNotes: ""
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ReceptionFormState | "selectedCatalogIds", string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decodePreview, setDecodePreview] = useState<VinDecodePreviewRecord | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  const clientLocations = useMemo(
    () => filterLocationsForClient(locations, form.serviceClientId),
    [locations, form.serviceClientId]
  );

  const prerequisiteMessage = vehicleCreatePrerequisiteMessage(serviceClients, locations);
  const vinIsValid = canDecodeVin(form.vin);

  useEffect(() => {
    if (!clientLocations.some((location) => location.id === form.locationId)) {
      setForm((current) => ({ ...current, locationId: clientLocations[0]?.id ?? "" }));
    }
  }, [clientLocations, form.locationId]);

  useEffect(() => {
    if (!vinIsValid) {
      setDecodePreview(null);
      setDecodeError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void decodeVinPreview(form.vin);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [form.vin, vinIsValid]);

  function updateForm<K extends keyof ReceptionFormState>(key: K, value: ReceptionFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleCatalogItem(itemId: string) {
    setForm((current) => ({
      ...current,
      selectedCatalogIds: current.selectedCatalogIds.includes(itemId)
        ? current.selectedCatalogIds.filter((id) => id !== itemId)
        : [...current.selectedCatalogIds, itemId]
    }));
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

    const errors = validateReceptionForm(form, { activeCatalogCount: activeCatalogItems.length });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const vehicleResponse = await fetch(`/api/company-operations/companies/${companyId}/vehicles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildReceptionVehiclePayload(form))
    });

    const vehiclePayload = (await vehicleResponse.json().catch(() => ({}))) as {
      message?: string;
      id?: string;
      vehicle?: { id?: string };
    };

    if (!vehicleResponse.ok) {
      setIsSubmitting(false);
      setSubmitError(vehiclePayload.message ?? "Unable to create vehicle.");
      return;
    }

    const vehicleId = vehiclePayload.vehicle?.id ?? vehiclePayload.id;
    if (!vehicleId) {
      setIsSubmitting(false);
      setSubmitError("Vehicle was created but the response was incomplete.");
      return;
    }

    const workOrderResponse = await fetch(`/api/company-operations/companies/${companyId}/work-orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildReceptionWorkOrderPayload(vehicleId, form))
    });

    const workOrderPayload = (await workOrderResponse.json().catch(() => ({}))) as {
      message?: string;
      id?: string;
      workOrder?: { id?: string };
    };

    setIsSubmitting(false);

    if (!workOrderResponse.ok) {
      setSubmitError(workOrderPayload.message ?? "Vehicle was saved, but the work order could not be created.");
      return;
    }

    const workOrderId = workOrderPayload.workOrder?.id ?? workOrderPayload.id;
    if (!workOrderId) {
      setSubmitError("Work order was created but the response was incomplete.");
      return;
    }

    router.push(`/jobs/${workOrderId}`);
    router.refresh();
  }

  if (activeClients.length === 0 || locations.length === 0) {
    const setupHref = activeClients.length === 0 ? "/service-clients" : "/locations";
    const setupLabel = activeClients.length === 0 ? "Go to Service Clients" : "Go to Locations";

    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {prerequisiteMessage}{" "}
        <Link href={setupHref} className="font-medium underline underline-offset-2">
          {setupLabel}
        </Link>
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30"
    >
      <p className="text-sm text-slate-600">{RECEPTION_HELPER_COPY}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="reception-service-client">
            Service client
          </label>
          <select
            id="reception-service-client"
            value={form.serviceClientId}
            onChange={(event) => updateForm("serviceClientId", event.target.value)}
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
          <label className="block text-sm font-medium text-slate-700" htmlFor="reception-location">
            Location
          </label>
          <select
            id="reception-location"
            value={form.locationId}
            onChange={(event) => updateForm("locationId", event.target.value)}
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

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="reception-vin">
            VIN
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              id="reception-vin"
              type="text"
              value={form.vin}
              onChange={(event) => updateForm("vin", event.target.value.toUpperCase())}
              maxLength={17}
              className="min-w-[16rem] flex-1 rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono uppercase text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              placeholder="17-character VIN"
              autoComplete="off"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => decodeVinPreview(form.vin)}
              disabled={!vinIsValid || isSubmitting || isDecoding}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDecoding ? "Decoding…" : "Decode VIN"}
            </button>
          </div>
          {fieldErrors.vin ? <p className="mt-1.5 text-sm text-red-600">{fieldErrors.vin}</p> : null}
          {isDecoding ? <p className="mt-2 text-sm text-slate-600">{vinDecodePreviewLoadingCopy()}</p> : null}
          {decodePreview ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">{formatDecodedVehicleSummary(decodePreview)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatVinDecodeSummary(decodePreview)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Source: {formatVinDecodeSourceLabel(decodePreview.decodeSource)} · preview only; server re-decodes on
                create.
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
          <label className="block text-sm font-medium text-slate-700" htmlFor="reception-plate">
            License plate
          </label>
          <input
            id="reception-plate"
            type="text"
            value={form.plate}
            onChange={(event) => updateForm("plate", event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            placeholder="Optional"
            autoComplete="off"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="reception-color">
            Vehicle color
          </label>
          <input
            id="reception-color"
            type="text"
            value={form.color}
            onChange={(event) => updateForm("color", event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            placeholder="Optional"
            autoComplete="off"
            disabled={isSubmitting}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="reception-vehicle-notes">
            Vehicle notes
          </label>
          <textarea
            id="reception-vehicle-notes"
            value={form.notes}
            onChange={(event) => updateForm("notes", event.target.value)}
            rows={2}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            placeholder="Optional intake notes"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold text-slate-900">Services</h2>
        <p className="mt-1 text-sm text-slate-500">Select one or more catalog services for this job.</p>

        {activeCatalogItems.length === 0 ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Add active services in{" "}
            <Link href="/service-catalog" className="font-medium underline underline-offset-2">
              Service Catalog
            </Link>{" "}
            before receiving vehicles.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {activeCatalogItems.map((item) => {
              const checked = form.selectedCatalogIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition ${
                    checked ? "border-brand-300 bg-brand-50/40" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCatalogItem(item.id)}
                    disabled={isSubmitting}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{item.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {formatWorkOrderMoney(item.fixedPriceMinor, item.currencyCode)}
                      {item.category ? ` · ${item.category}` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {fieldErrors.selectedCatalogIds ? (
          <p className="mt-2 text-sm text-red-600">{fieldErrors.selectedCatalogIds}</p>
        ) : null}
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700" htmlFor="reception-work-order-notes">
          Work order notes
        </label>
        <textarea
          id="reception-work-order-notes"
          value={form.workOrderNotes}
          onChange={(event) => updateForm("workOrderNotes", event.target.value)}
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          placeholder="Optional notes for the job"
          disabled={isSubmitting}
        />
      </div>

      {submitError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {submitError}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting || clientLocations.length === 0 || activeCatalogItems.length === 0}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "Creating job…" : "Create work order"}
        </button>
        <Link
          href="/jobs"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          View jobs
        </Link>
      </div>
    </form>
  );
}
