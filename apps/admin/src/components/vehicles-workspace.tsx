"use client";

import Link from "next/link";
import { useState } from "react";

import { CreateVehicleForm } from "./create-vehicle-form";
import { EditVehicleForm } from "./edit-vehicle-form";
import { VehicleDetailDrawer } from "./vehicle-detail-drawer";
import { VehicleStatusBadge } from "./vehicle-status-badge";
import {
  formatVehicleDate,
  formatVehicleTitle,
  vehicleIntakeDisclaimer,
  vehiclesEmptyMessage,
  type CompanyRecord,
  type LocationRecord,
  type ServiceClientRecord,
  type VehicleListRecord
} from "../lib/vehicle-utils";

type VehiclesWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly vehicles: VehicleListRecord[];
  readonly serviceClients: ServiceClientRecord[];
  readonly locations: LocationRecord[];
  readonly initialQuery: string;
  readonly initialStatus: "active" | "inactive" | "all";
  readonly initialServiceClientId: string;
  readonly initialLocationId: string;
};

export function VehiclesWorkspace({
  companies,
  selectedCompany,
  vehicles,
  serviceClients,
  locations,
  initialQuery,
  initialStatus,
  initialServiceClientId,
  initialLocationId
}: VehiclesWorkspaceProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;

  const activeClients = serviceClients.filter((client) => !client.archivedAt);
  const activeLocations = locations.filter((location) => !location.archivedAt);
  const emptyCopy = vehiclesEmptyMessage(vehicles.length > 0);

  function buildHref(overrides: {
    companyId?: string;
    status?: string;
    q?: string;
    serviceClientId?: string;
    locationId?: string;
  }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);

    const status = overrides.status ?? initialStatus;
    if (status !== "active") {
      params.set("status", status);
    }

    const search = overrides.q ?? initialQuery;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    const serviceClientId =
      overrides.serviceClientId !== undefined ? overrides.serviceClientId : initialServiceClientId;
    if (serviceClientId) {
      params.set("serviceClientId", serviceClientId);
    }

    const locationId = overrides.locationId !== undefined ? overrides.locationId : initialLocationId;
    if (locationId) {
      params.set("locationId", locationId);
    }

    return `/vehicles?${params.toString()}`;
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-200/30 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-slate-600">{vehicleIntakeDisclaimer()}</p>
        <CreateVehicleForm
          companyId={selectedCompany.id}
          serviceClients={serviceClients}
          locations={locations}
        />
      </div>

      {companies.length > 1 ? (
        <div className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company</p>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompany.id;
              return (
                <Link
                  key={company.id}
                  href={buildHref({ companyId: company.id })}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 font-medium text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {company.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
        <form method="get" className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <input type="hidden" name="companyId" value={selectedCompany.id} />
          {initialStatus !== "active" ? <input type="hidden" name="status" value={initialStatus} /> : null}
          {initialServiceClientId ? (
            <input type="hidden" name="serviceClientId" value={initialServiceClientId} />
          ) : null}
          {initialLocationId ? <input type="hidden" name="locationId" value={initialLocationId} /> : null}

          <div className="flex-1">
            <label
              className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400"
              htmlFor="vehicle-search"
            >
              Search
            </label>
            <input
              id="vehicle-search"
              name="q"
              type="search"
              defaultValue={initialQuery}
              placeholder="Search by VIN, plate, make, or model…"
              className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Apply search
          </button>
        </form>

        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(["active", "inactive", "all"] as const).map((status) => {
                const isSelected = initialStatus === status;
                const label = status === "active" ? "Active" : status === "inactive" ? "Inactive" : "All";
                return (
                  <Link
                    key={status}
                    href={buildHref({ status })}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Service client</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Link
                href={buildHref({ serviceClientId: "", locationId: "" })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  !initialServiceClientId
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                All
              </Link>
              {activeClients.map((client) => {
                const isSelected = initialServiceClientId === client.id;
                return (
                  <Link
                    key={client.id}
                    href={buildHref({ serviceClientId: client.id, locationId: "" })}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {client.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {initialServiceClientId ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Location</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Link
                  href={buildHref({ locationId: "" })}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    !initialLocationId
                      ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  All
                </Link>
                {activeLocations
                  .filter((location) => location.serviceClientId === initialServiceClientId)
                  .map((location) => {
                    const isSelected = initialLocationId === location.id;
                    return (
                      <Link
                        key={location.id}
                        href={buildHref({ locationId: location.id })}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                          isSelected
                            ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {location.name}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">{emptyCopy.title}</p>
          <p className="mt-2 text-sm text-slate-500">{emptyCopy.description}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      VIN
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Year / make / model
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Plate
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Color
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Service client
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Location
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Status
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Created
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-800">{vehicle.vin}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">{formatVehicleTitle(vehicle)}</td>
                      <td className="px-5 py-3.5 text-slate-600">{vehicle.plate ?? "—"}</td>
                      <td className="px-5 py-3.5 text-slate-600">{vehicle.color ?? "—"}</td>
                      <td className="px-5 py-3.5 text-slate-600">{vehicle.serviceClient.name}</td>
                      <td className="px-5 py-3.5 text-slate-600">{vehicle.location.name}</td>
                      <td className="px-5 py-3.5">
                        <VehicleStatusBadge archivedAt={vehicle.archivedAt} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{formatVehicleDate(vehicle.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedVehicleId(vehicle.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          <EditVehicleForm
                            vehicle={vehicle}
                            serviceClients={serviceClients}
                            locations={locations}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {vehicles.map((vehicle) => (
              <article
                key={vehicle.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{formatVehicleTitle(vehicle)}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{vehicle.vin}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {vehicle.serviceClient.name} · {vehicle.location.name}
                    </p>
                  </div>
                  <VehicleStatusBadge archivedAt={vehicle.archivedAt} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {vehicle.plate ? `Plate ${vehicle.plate}` : "No plate"}
                  {vehicle.color ? ` · ${vehicle.color}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-400">Added {formatVehicleDate(vehicle.createdAt)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVehicleId(vehicle.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    View details
                  </button>
                  <EditVehicleForm
                    vehicle={vehicle}
                    serviceClients={serviceClients}
                    locations={locations}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <VehicleDetailDrawer
        vehicle={selectedVehicle}
        companyName={selectedCompany.name}
        serviceClients={serviceClients}
        locations={locations}
        onClose={() => setSelectedVehicleId(null)}
      />
    </>
  );
}
