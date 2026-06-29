import {
  clientInvoiceDisclaimer,
  formatClientInvoiceDate,
  formatClientInvoiceLineSummary,
  formatClientInvoiceMoney,
  formatClientInvoiceNumberLabel,
  formatClientInvoiceStatusLabel,
  type ClientInvoiceListRecord
} from "../lib/client-invoice-utils";
import { ClientInvoiceStatusBadge } from "./client-invoice-status-badge";

type ClientInvoicePrintViewProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly companyName: string;
};

export function ClientInvoicePrintView({ invoice, companyName }: ClientInvoicePrintViewProps) {
  return (
    <article className="mx-auto max-w-3xl bg-white p-8 text-slate-900 print:p-0">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">LaborLedger invoice</p>
        <h1 className="mt-2 text-2xl font-semibold">{formatClientInvoiceNumberLabel(invoice)}</h1>
        <p className="mt-1 text-sm text-slate-600">{companyName}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ClientInvoiceStatusBadge status={invoice.status} />
          <span className="text-sm text-slate-500">
            {formatClientInvoiceStatusLabel(invoice.status)} · Created {formatClientInvoiceDate(invoice.createdAt)}
          </span>
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Bill to</h2>
          <p className="mt-2 text-sm font-medium">{invoice.serviceClient.name}</p>
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Issue details</h2>
          <p className="mt-2 text-sm text-slate-700">
            Issued {formatClientInvoiceDate(invoice.issuedAt)}
            {invoice.issuedByUser?.fullName ? ` · ${invoice.issuedByUser.fullName}` : ""}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Line items</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Service</th>
              <th className="py-2 pr-3">Work order / vehicle</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.lines ?? []).map((line) => (
              <tr key={line.id} className="border-b border-slate-100">
                <td className="py-3 pr-3 font-medium">{line.serviceNameSnapshot}</td>
                <td className="py-3 pr-3 text-slate-600">{formatClientInvoiceLineSummary(line)}</td>
                <td className="py-3 text-right font-medium">
                  {formatClientInvoiceMoney(line.lineTotalMinor, line.currencyCode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-1 text-sm text-slate-700">
          <p className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatClientInvoiceMoney(invoice.subtotalMinor, invoice.currencyCode)}</span>
          </p>
          <p className="flex justify-between">
            <span>Tax</span>
            <span>{formatClientInvoiceMoney(invoice.taxMinor, invoice.currencyCode)}</span>
          </p>
          <p className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatClientInvoiceMoney(invoice.totalMinor, invoice.currencyCode)}</span>
          </p>
        </div>
      </section>

      {invoice.notes ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">Notes</h2>
          <p className="mt-2 text-sm text-slate-700">{invoice.notes}</p>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        {clientInvoiceDisclaimer()}
      </footer>
    </article>
  );
}
