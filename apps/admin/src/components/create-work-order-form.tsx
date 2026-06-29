"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  filterActiveCatalogItems,
  filterActiveVehicles,
  formatWorkOrderMoney,
  formatWorkOrderVehicleSummary,
  workOrderDisclaimer,
  type ServiceCatalogListRecord,
  type VehicleListRecord,
  type WorkOrderStatus
} from "../lib/work-order-utils";

type CreateWorkOrderFormProps = {
  readonly companyId: string;
  readonly vehicles: VehicleListRecord[];
  readonly catalogItems: ServiceCatalogListRecord[];
};

export function CreateWorkOrderForm({ companyId, vehicles, catalogItems }: CreateWorkOrderFormProps) {
  const router = useRouter();
  const activeVehicles = useMemo(() => filterActiveVehicles(vehicles), [vehicles]);
  const activeCatalogItems = useMemo(() => filterActiveCatalogItems(catalogItems), [catalogItems]);
  const defaultVehicleId = activeVehicles[0]?.id ?? "";

  const [isOpen, setIsOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<WorkOrderStatus>("DRAFT");
  const [fieldErrors, setFieldErrors] = useState<{ vehicleId?: string; serviceLines?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedVehicle = activeVehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;

  function resetForm() {
    setVehicleId(defaultVehicleId);
    setSelectedCatalogIds([]);
    setNotes("");
    setStatus("DRAFT");
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

  function toggleCatalogItem(itemId: string) {
    setSelectedCatalogIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const nextFieldErrors: typeof fieldErrors = {};
    if (!vehicleId) nextFieldErrors.vehicleId = "Vehicle is required.";
    if (selectedCatalogIds.length === 0) {
      nextFieldErrors.serviceLines = "Select at least one active catalog service.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/companies/${companyId}/work-orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        serviceCatalogItemIds: selectedCatalogIds,
        notes: notes.trim() || undefined,
        status
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      workOrder?: { workOrderNumber?: string };
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to create work order.");
      return;
    }

    const createdNumber = payload.workOrder?.workOrderNumber ?? "Work order";
    setSuccessMessage(`${createdNumber} was created.`);
    resetForm();
    setIsOpen(false);
    router.refresh();
  }

  if (activeVehicles.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Add an active vehicle before creating work orders.
      </div>
    );
  }

  if (activeCatalogItems.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Add active catalog services before creating work orders.
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
        {isOpen ? "Cancel" : "Create work order"}
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
          <h2 className="text-sm font-semibold text-slate-900">New work order</h2>
          <p className="mt-1 text-sm text-slate-500">{workOrderDisclaimer()}</p>

          <div className="mt-6 grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="work-order-vehicle">
                Vehicle
              </label>
              <select
                id="work-order-vehicle"
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900"
                disabled={isSubmitting}
              >
                {activeVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {formatWorkOrderVehicleSummary(vehicle)}
                  </option>
                ))}
              </select>
              {fieldErrors.vehicleId ? (
                <p className="mt-1.5 text-sm text-red-600">{fieldErrors.vehicleId}</p>
              ) : null}
              {selectedVehicle ? (
                <p className="mt-2 text-xs text-slate-500">
                  Client: {selectedVehicle.serviceClient.name} · Location: {selectedVehicle.location.name}
                  {selectedVehicle.plate ? ` · Plate ${selectedVehicle.plate}` : ""}
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700">Catalog services</p>
              <p className="mt-1 text-xs text-slate-500">
                Prices are snapshotted when the work order is created.
              </p>
              <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                {activeCatalogItems.map((item) => {
                  const checked = selectedCatalogIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-2 hover:bg-white"
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
                        <span className="block text-xs text-slate-500">
                          {item.category ?? "No category"} ·{" "}
                          {formatWorkOrderMoney(item.fixedPriceMinor, item.currencyCode)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {fieldErrors.serviceLines ? (
                <p className="mt-1.5 text-sm text-red-600">{fieldErrors.serviceLines}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="work-order-status">
                  Initial status
                </label>
                <select
                  id="work-order-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as WorkOrderStatus)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900"
                  disabled={isSubmitting}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="READY">Ready</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="work-order-notes">
                Notes
              </label>
              <textarea
                id="work-order-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900"
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
              disabled={isSubmitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Creating…" : "Create work order"}
            </button>
            <button
              type="button"
              onClick={handleToggle}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
