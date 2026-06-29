"use client";

import { ArchiveServiceClientButton } from "./archive-service-client-button";
import { EditServiceClientForm } from "./edit-service-client-form";
import { ServiceClientStatusBadge } from "./service-client-status-badge";
import { formatServiceClientDate, type ServiceClientViewRecord } from "../lib/service-client-utils";

type ServiceClientDetailDrawerProps = {
  readonly client: ServiceClientViewRecord | null;
  readonly companyName: string;
  readonly onClose: () => void;
};

export function ServiceClientDetailDrawer({ client, companyName, onClose }: ServiceClientDetailDrawerProps) {
  if (!client) {
    return null;
  }

  const isArchived = Boolean(client.archivedAt);

  return (
    <>
      <button
        type="button"
        aria-label="Close service client detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl shadow-slate-300/30"
        role="dialog"
        aria-labelledby="service-client-detail-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="service-client-detail-title" className="truncate text-base font-semibold text-slate-900">
              {client.name}
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
            <ServiceClientStatusBadge archivedAt={client.archivedAt} />
            <span className="text-xs text-slate-500">Added {formatServiceClientDate(client.createdAt)}</span>
          </div>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Client details</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Name</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{client.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Active locations</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {client.locationCount} {client.locationCount === 1 ? "location" : "locations"}
                  </dd>
                </div>
                {client.updatedAt ? (
                  <div>
                    <dt className="text-xs text-slate-500">Last updated</dt>
                    <dd className="mt-0.5 text-slate-900">{formatServiceClientDate(client.updatedAt)}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Service clients group locations and shifts for scheduling and internal labor estimates. They are not
                invoices, receivables, or payroll records.
              </p>
              <div className="mt-4">
                <EditServiceClientForm serviceClientId={client.id} initialName={client.name} />
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
              {companyName}
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status</h3>
            <ArchiveServiceClientButton
              serviceClientId={client.id}
              serviceClientName={client.name}
              isArchived={isArchived}
            />
          </section>
        </div>
      </aside>
    </>
  );
}
