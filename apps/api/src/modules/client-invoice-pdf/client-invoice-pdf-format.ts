import { ClientInvoiceStatus } from "@prisma/client";

export const CLIENT_INVOICE_PDF_DISCLAIMER =
  "LaborLedger operational invoice. LaborLedger does not process payments, taxes, payroll, or accounting entries for this invoice.";

export function formatPdfMoney(minorUnits: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(minorUnits / 100);
}

export function formatPdfDate(value?: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(value);
}

export function formatPdfStatusLabel(status: ClientInvoiceStatus) {
  if (status === ClientInvoiceStatus.DRAFT) {
    return "Draft";
  }

  if (status === ClientInvoiceStatus.ISSUED) {
    return "Issued";
  }

  return "Void";
}

export function formatPdfInvoiceNumberLabel(invoiceNumber: string | null, clientInvoiceId: string) {
  if (invoiceNumber) {
    return invoiceNumber;
  }

  return `Draft ${clientInvoiceId.slice(0, 8)}`;
}

export function formatPdfLineSummary(input: {
  workOrderNumberSnapshot: string;
  vinSnapshot: string;
  vehicleLabelSnapshot: string | null;
  serviceNameSnapshot: string;
}) {
  const vehicle = input.vehicleLabelSnapshot ?? input.vinSnapshot;
  return `${input.workOrderNumberSnapshot} · ${vehicle}`;
}
