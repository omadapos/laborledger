"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CreateServiceClientForm } from "./create-service-client-form";
import { EditServiceClientForm } from "./edit-service-client-form";
import { ServiceClientDetailDrawer } from "./service-client-detail-drawer";
import { ServiceClientStatusBadge } from "./service-client-status-badge";
import {
  filterServiceClientsByQuery,
  formatServiceClientDate,
  type CompanyRecord,
  type ServiceClientViewRecord
} from "../lib/service-client-utils";

type ServiceClientsWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly serviceClients: ServiceClientViewRecord[];
  readonly initialQuery: string;
  readonly initialStatus: "active" | "inactive" | "all";
};

export function ServiceClientsWorkspace({
  companies,
  selectedCompany,
  serviceClients,
  initialQuery,
  initialStatus
}: ServiceClientsWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const filteredClients = useMemo(
    () => filterServiceClientsByQuery(serviceClients, query),
    [serviceClients, query]
  );

  const selectedClient =
    filteredClients.find((client) => client.id === selectedClientId) ??
    serviceClients.find((client) => client.id === selectedClientId) ??
    null;

  function buildServiceClientsHref(overrides: { companyId?: string; status?: string; q?: string }) {
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

    return `/service-clients?${params.toString()}`;
  }

  return (
    <>
      <div className="mb-6">
        <CreateServiceClientForm companyId={selectedCompany.id} />
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
                  href={buildServiceClientsHref({ companyId: company.id })}
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
          <label
            className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400"
            htmlFor="service-client-search"
          >
            Search
          </label>
          <input
            id="service-client-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by client name…"
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
                  href={buildServiceClientsHref({ status })}
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

      {filteredClients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            {serviceClients.length === 0 ? "No service clients yet" : "No service clients match your search"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {serviceClients.length === 0
              ? "Create a service client to group locations and shifts under a client record for this company."
              : "Try a different name or clear the search filter."}
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
                      Client name
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Company
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      Active locations
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
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedClientId(client.id)}
                          className="text-left font-medium text-slate-900 hover:text-brand-700"
                        >
                          {client.name}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">{selectedCompany.name}</td>
                      <td className="px-5 py-3.5 text-slate-600">{client.locationCount}</td>
                      <td className="px-5 py-3.5">
                        <ServiceClientStatusBadge archivedAt={client.archivedAt} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{formatServiceClientDate(client.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedClientId(client.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          <EditServiceClientForm serviceClientId={client.id} initialName={client.name} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredClients.map((client) => (
              <article
                key={client.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{client.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{selectedCompany.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {client.locationCount} active {client.locationCount === 1 ? "location" : "locations"}
                    </p>
                  </div>
                  <ServiceClientStatusBadge archivedAt={client.archivedAt} />
                </div>
                <p className="mt-3 text-xs text-slate-400">Added {formatServiceClientDate(client.createdAt)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    View details
                  </button>
                  <EditServiceClientForm serviceClientId={client.id} initialName={client.name} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <ServiceClientDetailDrawer
        client={selectedClient}
        companyName={selectedCompany.name}
        onClose={() => setSelectedClientId(null)}
      />
    </>
  );
}
