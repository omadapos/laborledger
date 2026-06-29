"use client";

import Link from "next/link";

import { invoicePrintHelperCopy } from "../lib/client-invoice-utils";

type PrintInvoiceButtonProps = {
  readonly invoiceId: string;
};

export function PrintInvoiceButton({ invoiceId }: PrintInvoiceButtonProps) {
  return (
    <div className="space-y-1">
      <Link
        href={`/client-invoices/${invoiceId}/print`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Print invoice
      </Link>
      <p className="text-xs text-slate-500">{invoicePrintHelperCopy()}</p>
    </div>
  );
}
