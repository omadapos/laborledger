"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CreateKioskForm } from "./create-kiosk-form";
import { KioskCredentialBadge } from "./kiosk-credential-badge";
import { KioskDetailDrawer } from "./kiosk-detail-drawer";
import { KioskStatusBadge } from "./kiosk-status-badge";
import {
  filterKiosksByQuery,
  formatKioskDate,
  KIOSK_SECRET_HELPER,
  locationsAvailableForKiosk,
  type CompanyRecord,
  type KioskRecord,
  type LocationOption
} from "../lib/kiosk-utils";

type KiosksWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly kiosks: KioskRecord[];
  readonly locations: LocationOption[];
  readonly apiUrl: string;
  readonly initialQuery: string;
  readonly initialStatus: "active" | "inactive" | "all";
  readonly initialLocationId: string;
};

export function KiosksWorkspace({
  companies,
  selectedCompany,
  kiosks,
  locations,
  apiUrl,
  initialQuery,
  initialStatus,
  initialLocationId
}: KiosksWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedKioskId, setSelectedKioskId] = useState<string | null>(null);

  const filteredKiosks = useMemo(() => filterKiosksByQuery(kiosks, query), [kiosks, query]);
  const availableLocations = useMemo(
    () => locationsAvailableForKiosk(locations, kiosks),
    [locations, kiosks]
  );

  const selectedKiosk =
    filteredKiosks.find((kiosk) => kiosk.id === selectedKioskId) ??
    kiosks.find((kiosk) => kiosk.id === selectedKioskId) ??
    null;

  function buildKiosksHref(overrides: {
    companyId?: string;
    status?: string;
    locationId?: string;
    q?: string;
  }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);

    const status = overrides.status ?? initialStatus;
    if (status !== "active") {
      params.set("status", status);
    }

    const locationId = overrides.locationId ?? initialLocationId;
    if (locationId) {
      params.set("locationId", locationId);
    }

    const search = overrides.q ?? query;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    return `/kiosks?${params.toString()}`;
  }

  return (
    <>
      <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
        {KIOSK_SECRET_HELPER}
      </p>

      <div className="mb-6">
        <CreateKioskForm
          companyId={selectedCompany.id}
          availableLocations={availableLocations}
          apiUrl={apiUrl}
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
                  href={buildKiosksHref({ companyId: company.id })}
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

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="kiosk-search">
            Search
          </label>
          <input
            id="kiosk-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by kiosk name or location…"
            className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Location</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Link
              href={buildKiosksHref({ locationId: "" })}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                !initialLocationId
                  ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              All
            </Link>
            {locations.map((location) => (
              <Link
                key={location.id}
                href={buildKiosksHref({ locationId: location.id })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  initialLocationId === location.id
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {location.name}
              </Link>
            ))}
          </div>
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
                  href={buildKiosksHref({ status })}
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

      {filteredKiosks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          No kiosks match the current filters. Create a kiosk for an active location without an existing device.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 font-medium text-slate-600">Kiosk</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Location</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Credential</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Created</th>
                  <th className="px-5 py-3 font-medium text-slate-600">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredKiosks.map((kiosk) => (
                  <tr key={kiosk.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-medium text-slate-900">{kiosk.name}</td>
                    <td className="px-5 py-4 text-slate-700">{kiosk.locationName}</td>
                    <td className="px-5 py-4">
                      <KioskStatusBadge archivedAt={kiosk.archivedAt} />
                    </td>
                    <td className="px-5 py-4">
                      <KioskCredentialBadge status={kiosk.credentialStatus} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatKioskDate(kiosk.createdAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedKioskId(kiosk.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredKiosks.map((kiosk) => (
              <article
                key={kiosk.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-slate-900">{kiosk.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-600">{kiosk.locationName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedKioskId(kiosk.id)}
                    className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    View
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <KioskStatusBadge archivedAt={kiosk.archivedAt} />
                  <KioskCredentialBadge status={kiosk.credentialStatus} />
                  <span className="text-xs text-slate-500">{formatKioskDate(kiosk.createdAt)}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <KioskDetailDrawer
        kiosk={selectedKiosk}
        companyName={selectedCompany.name}
        apiUrl={apiUrl}
        onClose={() => setSelectedKioskId(null)}
      />
    </>
  );
}
