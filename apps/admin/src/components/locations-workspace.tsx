"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CreateLocationForm } from "./create-location-form";
import { EditLocationForm } from "./edit-location-form";
import { LocationDetailDrawer } from "./location-detail-drawer";
import { LocationStatusBadge } from "./location-status-badge";
import {
  filterLocationsByQuery,
  formatLocationDate,
  type CompanyRecord,
  type LocationViewRecord,
  type ServiceClientRecord
} from "../lib/location-utils";

type LocationsWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly locations: LocationViewRecord[];
  readonly serviceClients: ServiceClientRecord[];
  readonly initialQuery: string;
  readonly initialStatus: "active" | "inactive" | "all";
  readonly canManageCompany: boolean;
};

export function LocationsWorkspace({
  companies,
  selectedCompany,
  locations,
  serviceClients,
  initialQuery,
  initialStatus,
  canManageCompany
}: LocationsWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const filteredLocations = useMemo(() => filterLocationsByQuery(locations, query), [locations, query]);

  const selectedLocation =
    filteredLocations.find((location) => location.id === selectedLocationId) ??
    locations.find((location) => location.id === selectedLocationId) ??
    null;

  function buildLocationsHref(overrides: { companyId?: string; status?: string; q?: string }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);

    const status = overrides.status ?? initialStatus;
    if (status !== "active") {
      params.set("status", status);
    }

    const search = overrides.q ?? query;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    return `/locations?${params.toString()}`;
  }

  return (
    <>
      {canManageCompany ? (
        <div className="mb-6">
          <CreateLocationForm companyId={selectedCompany.id} serviceClients={serviceClients} />
        </div>
      ) : null}

      {companies.length > 1 ? (
        <div className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company</p>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompany.id;
              return (
                <Link
                  key={company.id}
                  href={buildLocationsHref({ companyId: company.id })}
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

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="location-search">
            Search
          </label>
          <input
            id="location-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, client, or time zone…"
            className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(["active", "inactive", "all"] as const).map((status) => {
              const isSelected = initialStatus === status;
              const label = status === "active" ? "Active" : status === "inactive" ? "Inactive" : "All";
              return (
                <Link
                  key={status}
                  href={buildLocationsHref({ status })}
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
      </div>

      {filteredLocations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            {locations.length === 0 ? "No locations yet" : "No locations match your search"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {locations.length === 0
              ? "Create a location to define where work happens and set the time zone for scheduling."
              : "Try a different search term or clear the filter."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Location</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Client</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Time zone</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Status</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLocations.map((location) => (
                    <tr key={location.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedLocationId(location.id)}
                          className="text-left font-medium text-slate-900 hover:text-brand-700"
                        >
                          {location.name}
                        </button>
                        <p className="text-xs text-slate-500">{formatLocationDate(location.createdAt)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">{location.serviceClientName}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{location.timezone}</td>
                      <td className="px-5 py-3.5">
                        <LocationStatusBadge archivedAt={location.archivedAt} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedLocationId(location.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          {canManageCompany ? (
                            <EditLocationForm
                              locationId={location.id}
                              initialName={location.name}
                              initialTimezone={location.timezone}
                              initialServiceClientId={location.serviceClientId}
                              serviceClients={serviceClients}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredLocations.map((location) => (
              <article
                key={location.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{location.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{location.serviceClientName}</p>
                    <p className="mt-1 font-mono text-xs text-slate-600">{location.timezone}</p>
                  </div>
                  <LocationStatusBadge archivedAt={location.archivedAt} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLocationId(location.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    View details
                  </button>
                  {canManageCompany ? (
                    <EditLocationForm
                      locationId={location.id}
                      initialName={location.name}
                      initialTimezone={location.timezone}
                      initialServiceClientId={location.serviceClientId}
                      serviceClients={serviceClients}
                    />
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <LocationDetailDrawer
        location={selectedLocation}
        companyName={selectedCompany.name}
        serviceClients={serviceClients}
        canManageCompany={canManageCompany}
        onClose={() => setSelectedLocationId(null)}
      />
    </>
  );
}
