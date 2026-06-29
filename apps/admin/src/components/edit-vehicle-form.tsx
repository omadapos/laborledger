"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  filterLocationsForClient,
  parseOptionalMileageInput,
  type LocationRecord,
  type ServiceClientRecord,
  type VehicleListRecord
} from "../lib/vehicle-utils";

type EditVehicleFormProps = {
  readonly vehicle: VehicleListRecord;
  readonly serviceClients: ServiceClientRecord[];
  readonly locations: LocationRecord[];
  readonly onSaved?: () => void;
};

export function EditVehicleForm({ vehicle, serviceClients, locations, onSaved }: EditVehicleFormProps) {
  const router = useRouter();
  const activeClients = serviceClients.filter((client) => !client.archivedAt);

  const [isEditing, setIsEditing] = useState(false);
  const [serviceClientId, setServiceClientId] = useState(vehicle.serviceClientId);
  const [locationId, setLocationId] = useState(vehicle.locationId);
  const [plate, setPlate] = useState(vehicle.plate ?? "");
  const [color, setColor] = useState(vehicle.color ?? "");
  const [mileage, setMileage] = useState(vehicle.mileage != null ? String(vehicle.mileage) : "");
  const [notes, setNotes] = useState(vehicle.notes ?? "");
  const [fieldErrors, setFieldErrors] = useState<{ locationId?: string; mileage?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clientLocations = useMemo(
    () => filterLocationsForClient(locations, serviceClientId),
    [locations, serviceClientId]
  );

  useEffect(() => {
    if (!clientLocations.some((location) => location.id === locationId)) {
      setLocationId(clientLocations[0]?.id ?? "");
    }
  }, [clientLocations, locationId]);

  function resetFields() {
    setServiceClientId(vehicle.serviceClientId);
    setLocationId(vehicle.locationId);
    setPlate(vehicle.plate ?? "");
    setColor(vehicle.color ?? "");
    setMileage(vehicle.mileage != null ? String(vehicle.mileage) : "");
    setNotes(vehicle.notes ?? "");
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleCancel() {
    resetFields();
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const mileageResult = parseOptionalMileageInput(mileage);
    const mileageError = "error" in mileageResult ? mileageResult.error : undefined;

    const nextFieldErrors: typeof fieldErrors = {};
    if (!serviceClientId) {
      setSubmitError("Service client is required.");
      return;
    }
    if (!locationId) nextFieldErrors.locationId = "Location is required.";
    if (mileageError) nextFieldErrors.mileage = mileageError;

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/vehicles/${vehicle.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceClientId,
        locationId,
        plate: plate.trim() || null,
        color: color.trim() || null,
        mileage: mileageResult.mileage ?? null,
        notes: notes.trim() || null
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to update vehicle.");
      return;
    }

    setSuccessMessage("Vehicle details were saved.");
    setIsEditing(false);
    onSaved?.();
    router.refresh();
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          resetFields();
          setSuccessMessage(null);
          setIsEditing(true);
        }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Edit
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      <p className="text-xs text-slate-500">VIN cannot be changed after intake.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor={`edit-vehicle-client-${vehicle.id}`}>
            Service client
          </label>
          <select
            id={`edit-vehicle-client-${vehicle.id}`}
            value={serviceClientId}
            onChange={(event) => setServiceClientId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting}
          >
            {activeClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor={`edit-vehicle-location-${vehicle.id}`}>
            Location
          </label>
          <select
            id={`edit-vehicle-location-${vehicle.id}`}
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting || clientLocations.length === 0}
          >
            {clientLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          {fieldErrors.locationId ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.locationId}</p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor={`edit-vehicle-plate-${vehicle.id}`}>
            Plate
          </label>
          <input
            id={`edit-vehicle-plate-${vehicle.id}`}
            type="text"
            value={plate}
            onChange={(event) => setPlate(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor={`edit-vehicle-color-${vehicle.id}`}>
            Color
          </label>
          <input
            id={`edit-vehicle-color-${vehicle.id}`}
            type="text"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor={`edit-vehicle-mileage-${vehicle.id}`}>
            Mileage
          </label>
          <input
            id={`edit-vehicle-mileage-${vehicle.id}`}
            type="text"
            inputMode="numeric"
            value={mileage}
            onChange={(event) => setMileage(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting}
          />
          {fieldErrors.mileage ? <p className="mt-1 text-xs text-red-600">{fieldErrors.mileage}</p> : null}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600" htmlFor={`edit-vehicle-notes-${vehicle.id}`}>
            Notes
          </label>
          <textarea
            id={`edit-vehicle-notes-${vehicle.id}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting || clientLocations.length === 0}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300"
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
