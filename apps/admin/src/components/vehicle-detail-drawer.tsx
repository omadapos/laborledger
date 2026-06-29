"use client";

import { ArchiveVehicleButton } from "./archive-vehicle-button";
import { EditVehicleForm } from "./edit-vehicle-form";
import { VehicleStatusBadge } from "./vehicle-status-badge";
import {
  formatVehicleDate,
  formatVehicleTitle,
  vehicleIntakeDisclaimer,
  type LocationRecord,
  type ServiceClientRecord,
  type VehicleListRecord
} from "../lib/vehicle-utils";

type VehicleDetailDrawerProps = {
  readonly vehicle: VehicleListRecord | null;
  readonly companyName: string;
  readonly serviceClients: ServiceClientRecord[];
  readonly locations: LocationRecord[];
  readonly onClose: () => void;
};

export function VehicleDetailDrawer({
  vehicle,
  companyName,
  serviceClients,
  locations,
  onClose
}: VehicleDetailDrawerProps) {
  if (!vehicle) {
    return null;
  }

  const isArchived = Boolean(vehicle.archivedAt);
  const vehicleLabel = formatVehicleTitle(vehicle);

  return (
    <>
      <button
        type="button"
        aria-label="Close vehicle detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl shadow-slate-300/30"
        role="dialog"
        aria-labelledby="vehicle-detail-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="vehicle-detail-title" className="truncate text-base font-semibold text-slate-900">
              {vehicleLabel}
            </h2>
            <p className="font-mono text-xs text-slate-500">{vehicle.vin}</p>
            <p className="text-xs text-slate-500">{companyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <VehicleStatusBadge archivedAt={vehicle.archivedAt} />
            <span className="text-xs text-slate-500">Added {formatVehicleDate(vehicle.createdAt)}</span>
          </div>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Decoded vehicle data</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Year / make / model</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{formatVehicleTitle(vehicle)}</dd>
                </div>
                {vehicle.trim ? (
                  <div>
                    <dt className="text-xs text-slate-500">Trim</dt>
                    <dd className="mt-0.5 text-slate-900">{vehicle.trim}</dd>
                  </div>
                ) : null}
                {vehicle.bodyClass ? (
                  <div>
                    <dt className="text-xs text-slate-500">Body class</dt>
                    <dd className="mt-0.5 text-slate-900">{vehicle.bodyClass}</dd>
                  </div>
                ) : null}
                {vehicle.vehicleType ? (
                  <div>
                    <dt className="text-xs text-slate-500">Vehicle type</dt>
                    <dd className="mt-0.5 text-slate-900">{vehicle.vehicleType}</dd>
                  </div>
                ) : null}
                {vehicle.fuelType ? (
                  <div>
                    <dt className="text-xs text-slate-500">Fuel type</dt>
                    <dd className="mt-0.5 text-slate-900">{vehicle.fuelType}</dd>
                  </div>
                ) : null}
                {vehicle.decodeSource ? (
                  <div>
                    <dt className="text-xs text-slate-500">Decode source</dt>
                    <dd className="mt-0.5 text-slate-900">{vehicle.decodeSource}</dd>
                  </div>
                ) : null}
                {vehicle.decodedAt ? (
                  <div>
                    <dt className="text-xs text-slate-500">Decoded at</dt>
                    <dd className="mt-0.5 text-slate-900">{formatVehicleDate(vehicle.decodedAt)}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Decode data comes from the VIN01 stub adapter. A government VIN API is not live yet.
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Intake details</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Service client</dt>
                  <dd className="mt-0.5 text-slate-900">{vehicle.serviceClient.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Location</dt>
                  <dd className="mt-0.5 text-slate-900">{vehicle.location.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Plate</dt>
                  <dd className="mt-0.5 text-slate-900">{vehicle.plate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Color</dt>
                  <dd className="mt-0.5 text-slate-900">{vehicle.color ?? "—"}</dd>
                </div>
                {vehicle.mileage != null ? (
                  <div>
                    <dt className="text-xs text-slate-500">Mileage</dt>
                    <dd className="mt-0.5 text-slate-900">{vehicle.mileage.toLocaleString()}</dd>
                  </div>
                ) : null}
                {vehicle.notes ? (
                  <div>
                    <dt className="text-xs text-slate-500">Notes</dt>
                    <dd className="mt-0.5 text-slate-900">{vehicle.notes}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">{vehicleIntakeDisclaimer()}</p>
              <EditVehicleForm
                vehicle={vehicle}
                serviceClients={serviceClients}
                locations={locations}
                onSaved={onClose}
              />
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status</h3>
            <ArchiveVehicleButton
              vehicleId={vehicle.id}
              vehicleLabel={vehicleLabel}
              isArchived={isArchived}
              onStatusChange={onClose}
            />
          </section>
        </div>
      </aside>
    </>
  );
}
