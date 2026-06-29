"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CreateServiceCatalogForm } from "./create-service-catalog-form";
import { EditServiceCatalogForm } from "./edit-service-catalog-form";
import { ServiceCatalogDetailDrawer } from "./service-catalog-detail-drawer";
import { ServiceCatalogStatusBadge } from "./service-catalog-status-badge";
import {
  collectServiceCatalogCategories,
  filterServiceCatalogItems,
  formatServiceCatalogDate,
  formatServiceCatalogPrice,
  serviceCatalogPricingDisclaimer,
  type CompanyRecord,
  type ServiceCatalogListRecord
} from "../lib/service-catalog-utils";

type ServiceCatalogWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly items: ServiceCatalogListRecord[];
  readonly initialQuery: string;
  readonly initialStatus: "active" | "inactive" | "all";
  readonly initialCategory: string;
};

export function ServiceCatalogWorkspace({
  companies,
  selectedCompany,
  items,
  initialQuery,
  initialStatus,
  initialCategory
}: ServiceCatalogWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const categories = useMemo(() => collectServiceCatalogCategories(items), [items]);

  const filteredItems = useMemo(
    () => filterServiceCatalogItems(items, query, initialCategory),
    [items, query, initialCategory]
  );

  const selectedItem =
    filteredItems.find((item) => item.id === selectedItemId) ??
    items.find((item) => item.id === selectedItemId) ??
    null;

  function buildHref(overrides: { companyId?: string; status?: string; q?: string; category?: string }) {
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

    const category = overrides.category ?? initialCategory;
    if (category.trim()) {
      params.set("category", category.trim());
    }

    return `/service-catalog?${params.toString()}`;
  }

  return (
    <>
      <p className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        {serviceCatalogPricingDisclaimer()}
      </p>

      <div className="mb-6">
        <CreateServiceCatalogForm companyId={selectedCompany.id} />
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

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-1">
          <label
            className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400"
            htmlFor="service-catalog-search"
          >
            Search
          </label>
          <input
            id="service-catalog-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by service name, category, or description…"
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

        {categories.length > 0 ? (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Category</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Link
                href={buildHref({ category: "" })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  !initialCategory
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                All
              </Link>
              {categories.map((category) => {
                const isSelected = initialCategory.toLowerCase() === category.toLowerCase();
                return (
                  <Link
                    key={category}
                    href={buildHref({ category })}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {category}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            {items.length === 0 ? "No catalog services yet" : "No services match your filters"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {items.length === 0
              ? "Create configurable services with fixed prices for future vehicle work orders and client invoices."
              : "Try a different search, status, or category filter."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Service name
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Category
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Fixed price
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Currency
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
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedItemId(item.id)}
                          className="text-left font-medium text-slate-900 hover:text-brand-700"
                        >
                          {item.name}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{item.category ?? "—"}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {formatServiceCatalogPrice(item.fixedPriceMinor, item.currencyCode)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{item.currencyCode}</td>
                      <td className="px-5 py-3.5">
                        <ServiceCatalogStatusBadge archivedAt={item.archivedAt} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{formatServiceCatalogDate(item.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedItemId(item.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          <EditServiceCatalogForm item={item} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.category ?? "No category"}</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {formatServiceCatalogPrice(item.fixedPriceMinor, item.currencyCode)}
                    </p>
                  </div>
                  <ServiceCatalogStatusBadge archivedAt={item.archivedAt} />
                </div>
                <p className="mt-3 text-xs text-slate-400">Added {formatServiceCatalogDate(item.createdAt)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    View details
                  </button>
                  <EditServiceCatalogForm item={item} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <ServiceCatalogDetailDrawer
        item={selectedItem}
        companyName={selectedCompany.name}
        onClose={() => setSelectedItemId(null)}
      />
    </>
  );
}
