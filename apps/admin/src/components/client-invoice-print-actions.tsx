"use client";

import { useEffect } from "react";

import { invoicePrintHelperCopy } from "../lib/client-invoice-utils";

export function ClientInvoicePrintActions() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 print:hidden">
      <p className="text-sm text-slate-600">{invoicePrintHelperCopy()}</p>
      <button
        type="button"
        onClick={() => window.print()}
        className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Print invoice
      </button>
    </div>
  );
}
