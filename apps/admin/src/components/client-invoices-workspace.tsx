"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ClientInvoiceDetailDrawer } from "./client-invoice-detail-drawer";
import { ClientInvoiceStatusBadge } from "./client-invoice-status-badge";
import { CreateClientInvoiceForm } from "./create-client-invoice-form";
import {
  CLIENT_INVOICE_STATUS_OPTIONS,
  clientInvoiceDisclaimer,
  clientInvoicesEmptyMessage,
  formatClientInvoiceDate,
  formatClientInvoiceMoney,
  formatClientInvoiceNumberLabel,
  type ClientInvoiceListRecord,
  type CompanyRecord,
  type ServiceClientRecord
} from "../lib/client-invoice-utils";

type ClientInvoicesWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly invoices: ClientInvoiceListRecord[];
  readonly serviceClients: ServiceClientRecord[];
  readonly initialQuery: string;
  readonly initialStatus: string;
  readonly initialServiceClientId: string;
};

export function ClientInvoicesWorkspace({
  companies,
  selectedCompany,
  invoices,
  serviceClients,
  initialQuery,
  initialStatus,
  initialServiceClientId
}: ClientInvoicesWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const filteredInvoices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return invoices;
    }

    return invoices.filter((invoice) => {
      const haystack = [
        invoice.invoiceNumber,
        invoice.serviceClient.name,
        invoice.id
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [invoices, query]);

  const emptyCopy = clientInvoicesEmptyMessage(invoices.length > 0);

  function buildHref(overrides: {
    companyId?: string;
    status?: string;
    q?: string;
    serviceClientId?: string;
  }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);

    const status = overrides.status ?? initialStatus;
    if (status) {
      params.set("status", status);
    }

    const clientId = overrides.serviceClientId ?? initialServiceClientId;
    if (clientId) {
      params.set("serviceClientId", clientId);
    }

    const search = overrides.q ?? query;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    return `/client-invoices?${params.toString()}`;
  }

  return (
    <>
      <p className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        {clientInvoiceDisclaimer()}
      </p>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {companies.map((company) => (
            <Link
              key={company.id}
              href={buildHref({ companyId: company.id })}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                company.id === selectedCompany.id
                  ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {company.name}
            </Link>
          ))}
        </div>

        <CreateClientInvoiceForm company={selectedCompany} serviceClients={serviceClients} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="invoice-search">
            Search
          </label>
          <form
            className="mt-1.5 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              window.location.href = buildHref({ q: query });
            }}
          >
            <input
              id="invoice-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Invoice number, client, VIN…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Search
            </button>
          </form>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Link
              href={buildHref({ status: "" })}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                !initialStatus
                  ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              All
            </Link>
            {CLIENT_INVOICE_STATUS_OPTIONS.map((status) => (
              <Link
                key={status}
                href={buildHref({ status })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  initialStatus === status
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {status === "DRAFT" ? "Draft" : status === "ISSUED" ? "Issued" : "Void"}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Service client</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Link
            href={buildHref({ serviceClientId: "" })}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              !initialServiceClientId
                ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            All clients
          </Link>
          {serviceClients
            .filter((client) => !client.archivedAt)
            .map((client) => (
              <Link
                key={client.id}
                href={buildHref({ serviceClientId: client.id })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  initialServiceClientId === client.id
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {client.name}
              </Link>
            ))}
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <p className="text-base font-medium text-slate-900">{emptyCopy.title}</p>
          <p className="mt-2 text-sm text-slate-500">{emptyCopy.description}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {["Invoice", "Status", "Client", "Work orders", "Total", "Created", "Issued"].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceId(invoice.id)}
                        className="text-left hover:text-brand-700"
                      >
                        {formatClientInvoiceNumberLabel(invoice)}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <ClientInvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{invoice.serviceClient.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{invoice.workOrderCount}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {formatClientInvoiceMoney(invoice.totalMinor, invoice.currencyCode)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {formatClientInvoiceDate(invoice.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {formatClientInvoiceDate(invoice.issuedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredInvoices.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                onClick={() => setSelectedInvoiceId(invoice.id)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatClientInvoiceNumberLabel(invoice)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{invoice.serviceClient.name}</p>
                  </div>
                  <ClientInvoiceStatusBadge status={invoice.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{invoice.workOrderCount} work orders</span>
                  <span>{invoice.vehicleCount} vehicles</span>
                  <span>{formatClientInvoiceMoney(invoice.totalMinor, invoice.currencyCode)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <ClientInvoiceDetailDrawer
        invoiceId={selectedInvoiceId}
        companyName={selectedCompany.name}
        onClose={() => setSelectedInvoiceId(null)}
        onUpdated={() => router.refresh()}
      />
    </>
  );
}
