"use client";

import { useEffect, useState } from "react";

import { ClientInvoiceStatusBadge } from "./client-invoice-status-badge";
import { IssueClientInvoiceButton } from "./issue-client-invoice-button";
import { PrintInvoiceButton } from "./print-invoice-button";
import { DownloadInvoicePdfButton } from "./download-invoice-pdf-button";
import { SendClientInvoiceEmailButton } from "./send-client-invoice-email-button";
import { VoidClientInvoiceButton } from "./void-client-invoice-button";
import {
  clientInvoiceDisclaimer,
  formatClientInvoiceDate,
  formatClientInvoiceDeliverySummary,
  formatClientInvoiceLineSummary,
  formatClientInvoiceMoney,
  formatClientInvoiceNumberLabel,
  type ClientInvoiceListRecord
} from "../lib/client-invoice-utils";

type ClientInvoiceDetailDrawerProps = {
  readonly invoiceId: string | null;
  readonly companyName: string;
  readonly onClose: () => void;
  readonly onUpdated?: () => void;
};

export function ClientInvoiceDetailDrawer({
  invoiceId,
  companyName,
  onClose,
  onUpdated
}: ClientInvoiceDetailDrawerProps) {
  const [invoice, setInvoice] = useState<ClientInvoiceListRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  function reloadInvoice() {
    setReloadToken((value) => value + 1);
    onUpdated?.();
  }

  useEffect(() => {
    if (!invoiceId) {
      setInvoice(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    fetch(`/api/company-operations/client-invoices/${invoiceId}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as ClientInvoiceListRecord & {
          message?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setInvoice(null);
          setErrorMessage(payload.message ?? "Unable to load invoice detail.");
          return;
        }

        setInvoice(payload);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [invoiceId, reloadToken]);

  if (!invoiceId) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close invoice detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl shadow-slate-300/30"
        role="dialog"
        aria-labelledby="client-invoice-detail-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="client-invoice-detail-title" className="truncate text-base font-semibold text-slate-900">
              {invoice ? formatClientInvoiceNumberLabel(invoice) : "Invoice detail"}
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
          {isLoading ? <p className="text-sm text-slate-500">Loading invoice…</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          {invoice ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <ClientInvoiceStatusBadge status={invoice.status} />
                <span className="text-xs text-slate-500">
                  Created {formatClientInvoiceDate(invoice.createdAt)}
                </span>
              </div>

              <section className="mt-6 space-y-3">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Client</h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
                  <p className="font-medium text-slate-900">{invoice.serviceClient.name}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {invoice.workOrderCount} work order{invoice.workOrderCount === 1 ? "" : "s"} ·{" "}
                    {invoice.vehicleCount} vehicle{invoice.vehicleCount === 1 ? "" : "s"}
                  </p>
                  {invoice.issuedAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Issued {formatClientInvoiceDate(invoice.issuedAt)}
                      {invoice.issuedByUser?.fullName ? ` · ${invoice.issuedByUser.fullName}` : ""}
                    </p>
                  ) : null}
                  {invoice.voidedAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Voided {formatClientInvoiceDate(invoice.voidedAt)}
                      {invoice.voidReason ? ` · ${invoice.voidReason}` : ""}
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="mt-6 space-y-3">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Invoice lines</h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <ul className="space-y-3">
                    {(invoice.lines ?? []).map((line) => (
                      <li key={line.id} className="border-b border-slate-200/80 pb-3 last:border-b-0 last:pb-0">
                        <p className="text-sm font-medium text-slate-900">{line.serviceNameSnapshot}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatClientInvoiceLineSummary(line)}</p>
                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {formatClientInvoiceMoney(line.lineTotalMinor, line.currencyCode)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm text-slate-700">
                    <p>Subtotal: {formatClientInvoiceMoney(invoice.subtotalMinor, invoice.currencyCode)}</p>
                    <p>Tax: {formatClientInvoiceMoney(invoice.taxMinor, invoice.currencyCode)}</p>
                    <p className="font-semibold text-slate-900">
                      Total: {formatClientInvoiceMoney(invoice.totalMinor, invoice.currencyCode)}
                    </p>
                  </div>
                </div>
              </section>

              {invoice.notes ? (
                <section className="mt-6 space-y-3">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Notes</h3>
                  <p className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
                    {invoice.notes}
                  </p>
                </section>
              ) : null}

              <section className="mt-6 space-y-3">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Actions</h3>
                <p className="text-xs leading-relaxed text-slate-500">{clientInvoiceDisclaimer()}</p>
                <PrintInvoiceButton invoiceId={invoice.id} />
                <DownloadInvoicePdfButton invoice={invoice} />
                <SendClientInvoiceEmailButton invoice={invoice} onSent={reloadInvoice} />
                <IssueClientInvoiceButton invoice={invoice} onIssued={onClose} />
                <VoidClientInvoiceButton invoice={invoice} onVoided={onClose} />
              </section>

              {(invoice.deliveries ?? []).length > 0 ? (
                <section className="mt-6 space-y-3">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                    Email delivery history
                  </h3>
                  <ul className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-600">
                    {(invoice.deliveries ?? []).map((delivery) => (
                      <li key={delivery.id}>
                        <p>{formatClientInvoiceDeliverySummary(delivery)}</p>
                        {delivery.errorMessage ? (
                          <p className="mt-0.5 text-red-600">{delivery.errorMessage}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}
