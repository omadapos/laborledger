import { formatClientInvoiceStatusLabel, type ClientInvoiceStatus } from "../lib/client-invoice-utils";

type ClientInvoiceStatusBadgeProps = {
  readonly status: ClientInvoiceStatus;
};

export function ClientInvoiceStatusBadge({ status }: ClientInvoiceStatusBadgeProps) {
  if (status === "VOID") {
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
        {formatClientInvoiceStatusLabel(status)}
      </span>
    );
  }

  if (status === "ISSUED") {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-200/80 bg-emerald-50/80 px-2 py-0.5 text-xs font-medium text-emerald-800">
        {formatClientInvoiceStatusLabel(status)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-amber-200/80 bg-amber-50/80 px-2 py-0.5 text-xs font-medium text-amber-800">
      {formatClientInvoiceStatusLabel(status)}
    </span>
  );
}
