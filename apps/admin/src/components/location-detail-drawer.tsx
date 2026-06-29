"use client";

import { ArchiveLocationButton } from "./archive-location-button";
import { EditLocationForm } from "./edit-location-form";
import { LocationStatusBadge } from "./location-status-badge";
import {
  formatLocationDate,
  type LocationViewRecord,
  type ServiceClientRecord
} from "../lib/location-utils";

type LocationDetailDrawerProps = {
  readonly location: LocationViewRecord | null;
  readonly companyName: string;
  readonly serviceClients: ServiceClientRecord[];
  readonly canManageCompany: boolean;
  readonly onClose: () => void;
};

export function LocationDetailDrawer({
  location,
  companyName,
  serviceClients,
  canManageCompany,
  onClose
}: LocationDetailDrawerProps) {
  if (!location) {
    return null;
  }

  const isArchived = Boolean(location.archivedAt);

  return (
    <>
      <button
        type="button"
        aria-label="Close location detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl shadow-slate-300/30"
        role="dialog"
        aria-labelledby="location-detail-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="location-detail-title" className="truncate text-base font-semibold text-slate-900">
              {location.name}
            </h2>
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
            <LocationStatusBadge archivedAt={location.archivedAt} />
            <span className="text-xs text-slate-500">Added {formatLocationDate(location.createdAt)}</span>
          </div>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Site details</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Name</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{location.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Service client</dt>
                  <dd className="mt-0.5 text-slate-900">{location.serviceClientName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Time zone (IANA)</dt>
                  <dd className="mt-0.5 font-mono text-sm text-slate-900">{location.timezone}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Weekly periods run Monday through Sunday in this location&apos;s time zone. Overnight shifts and punch
                interpretation will use this identifier — not the browser&apos;s local clock.
              </p>
              {canManageCompany ? (
                <div className="mt-4">
                  <EditLocationForm
                    locationId={location.id}
                    initialName={location.name}
                    initialTimezone={location.timezone}
                    initialServiceClientId={location.serviceClientId}
                    serviceClients={serviceClients}
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
              {companyName}
            </div>
          </section>

          {canManageCompany ? (
            <section className="mt-6 space-y-3">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status</h3>
              <ArchiveLocationButton
                locationId={location.id}
                locationName={location.name}
                isArchived={isArchived}
              />
            </section>
          ) : null}
        </div>
      </aside>
    </>
  );
}
