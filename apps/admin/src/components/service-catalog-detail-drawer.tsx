"use client";

import { ArchiveServiceCatalogButton } from "./archive-service-catalog-button";
import { EditServiceCatalogForm } from "./edit-service-catalog-form";
import { ServiceCatalogStatusBadge } from "./service-catalog-status-badge";
import {
  formatServiceCatalogDate,
  formatServiceCatalogPrice,
  serviceCatalogPricingDisclaimer,
  type ServiceCatalogListRecord
} from "../lib/service-catalog-utils";

type ServiceCatalogDetailDrawerProps = {
  readonly item: ServiceCatalogListRecord | null;
  readonly companyName: string;
  readonly onClose: () => void;
};

export function ServiceCatalogDetailDrawer({ item, companyName, onClose }: ServiceCatalogDetailDrawerProps) {
  if (!item) {
    return null;
  }

  const isArchived = Boolean(item.archivedAt);

  return (
    <>
      <button
        type="button"
        aria-label="Close service detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl shadow-slate-300/30"
        role="dialog"
        aria-labelledby="service-catalog-detail-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="service-catalog-detail-title" className="truncate text-base font-semibold text-slate-900">
              {item.name}
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
            <ServiceCatalogStatusBadge archivedAt={item.archivedAt} />
            <span className="text-xs text-slate-500">Added {formatServiceCatalogDate(item.createdAt)}</span>
          </div>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Service details</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Fixed service price</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {formatServiceCatalogPrice(item.fixedPriceMinor, item.currencyCode)}
                  </dd>
                </div>
                {item.category ? (
                  <div>
                    <dt className="text-xs text-slate-500">Category</dt>
                    <dd className="mt-0.5 text-slate-900">{item.category}</dd>
                  </div>
                ) : null}
                {item.description ? (
                  <div>
                    <dt className="text-xs text-slate-500">Description</dt>
                    <dd className="mt-0.5 text-slate-900">{item.description}</dd>
                  </div>
                ) : null}
                {item.updatedAt ? (
                  <div>
                    <dt className="text-xs text-slate-500">Last updated</dt>
                    <dd className="mt-0.5 text-slate-900">{formatServiceCatalogDate(item.updatedAt)}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">{serviceCatalogPricingDisclaimer()}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Work orders and client invoices are not wired yet. Future jobs will snapshot this price when lines are
                created or invoices are issued.
              </p>
              <div className="mt-4">
                <EditServiceCatalogForm item={item} onSaved={onClose} />
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status</h3>
            <ArchiveServiceCatalogButton
              serviceCatalogItemId={item.id}
              serviceName={item.name}
              isArchived={isArchived}
              onStatusChange={onClose}
            />
          </section>
        </div>
      </aside>
    </>
  );
}
