import type { CompanyRecord } from "./employee-utils";
import type { ServiceClientRecord } from "./location-utils";

export type ClientInvoiceStatus = "DRAFT" | "ISSUED" | "VOID";

export type ClientInvoiceLineRecord = {
  id: string;
  workOrderId: string;
  workOrderServiceLineId: string;
  vehicleId: string;
  workOrderNumberSnapshot: string;
  vinSnapshot: string;
  vehicleLabelSnapshot: string | null;
  serviceNameSnapshot: string;
  serviceCategorySnapshot: string | null;
  description: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  currencyCode: string;
  createdAt: string;
};

export type ClientInvoiceDeliveryRecord = {
  id: string;
  channel: string;
  recipientEmail: string;
  subject: string;
  status: "SENT" | "FAILED";
  provider: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  messageNote: string | null;
  sentAt: string | null;
  attemptedAt: string;
  createdAt: string;
  sentByUser?: { id: string; fullName: string | null; email: string } | null;
};

export type ClientInvoiceListRecord = {
  id: string;
  companyId?: string;
  serviceClientId?: string;
  invoiceNumber: string | null;
  status: ClientInvoiceStatus;
  serviceClient: { id: string; name: string };
  workOrderCount: number;
  vehicleCount: number;
  lineCount: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  currencyCode: string;
  createdAt: string;
  issuedAt: string | null;
  notes?: string | null;
  updatedAt?: string;
  voidedAt?: string | null;
  voidReason?: string | null;
  issuedByUser?: { id: string; fullName: string | null; email: string } | null;
  voidedByUser?: { id: string; fullName: string | null; email: string } | null;
  lines?: ClientInvoiceLineRecord[];
  workOrderIds?: string[];
  deliveries?: ClientInvoiceDeliveryRecord[];
};

export type InvoiceableWorkOrderRecord = {
  id: string;
  workOrderNumber: string;
  serviceClientId: string;
  vehicle: {
    id: string;
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
    plate: string | null;
  };
  serviceLineCount: number;
  totalServiceAmountMinor: number;
  currencyCode: string;
  serviceLines: Array<{
    id: string;
    serviceNameSnapshot: string;
    serviceCategorySnapshot: string | null;
    lineTotalMinor: number;
    currencyCode: string;
  }>;
};

export const CLIENT_INVOICE_STATUS_OPTIONS: ClientInvoiceStatus[] = ["DRAFT", "ISSUED", "VOID"];

export function clientInvoiceDisclaimer() {
  return "Invoices are client-facing service records. They do not calculate payroll, taxes, payments, or accounting entries.";
}

export function formatClientInvoiceStatusLabel(status: ClientInvoiceStatus) {
  if (status === "DRAFT") return "Draft";
  if (status === "ISSUED") return "Issued";
  return "Void";
}

export function formatClientInvoiceNumberLabel(invoice: Pick<ClientInvoiceListRecord, "invoiceNumber" | "status" | "id">) {
  if (invoice.invoiceNumber) {
    return invoice.invoiceNumber;
  }

  return `Draft ${invoice.id.slice(0, 8)}`;
}

export function formatClientInvoiceMoney(minorUnits: number, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(minorUnits / 100);
}

export function formatClientInvoiceDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

export function formatClientInvoiceLineSummary(line: ClientInvoiceLineRecord) {
  const vehicle = line.vehicleLabelSnapshot ?? line.vinSnapshot;
  return `${line.workOrderNumberSnapshot} · ${vehicle} · ${line.serviceNameSnapshot}`;
}

export function clientInvoicesEmptyMessage(hasAnyInvoices: boolean) {
  if (hasAnyInvoices) {
    return {
      title: "No invoices match your filters",
      description: "Try a different search, status, or service client filter."
    };
  }

  return {
    title: "No client invoices yet",
    description: "Create a draft invoice from completed, uninvoiced work orders for a service client."
  };
}

export function buildClientInvoiceListQuery(options: {
  serviceClientId?: string;
  status?: ClientInvoiceStatus;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (options.serviceClientId) {
    params.set("serviceClientId", options.serviceClientId);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function sumSelectedWorkOrderTotals(workOrders: InvoiceableWorkOrderRecord[]) {
  return workOrders.reduce((sum, workOrder) => sum + workOrder.totalServiceAmountMinor, 0);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function isValidInvoiceRecipientEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

export function invoiceEmailSendDisabledCopy(status: ClientInvoiceStatus) {
  if (status === "DRAFT") {
    return "Issue invoice before sending by email.";
  }

  if (status === "VOID") {
    return "Voided invoices cannot be sent.";
  }

  return null;
}

export function formatClientInvoiceDeliveryStatusLabel(status: ClientInvoiceDeliveryRecord["status"]) {
  return status === "SENT" ? "Sent" : "Failed";
}

export function formatClientInvoiceDeliverySummary(delivery: ClientInvoiceDeliveryRecord) {
  const when = formatClientInvoiceDate(delivery.sentAt ?? delivery.attemptedAt);
  const actor = delivery.sentByUser?.fullName ? ` · ${delivery.sentByUser.fullName}` : "";
  return `${delivery.recipientEmail} · ${formatClientInvoiceDeliveryStatusLabel(delivery.status)} · ${when}${actor}`;
}

export function invoicePrintHelperCopy() {
  return "Use your browser print dialog to save as PDF.";
}

export function buildClientInvoicePdfPath(clientInvoiceId: string) {
  return `/api/company-operations/client-invoices/${clientInvoiceId}/pdf`;
}

export function clientInvoicePdfButtonLabel(status: ClientInvoiceStatus) {
  if (status === "DRAFT") {
    return "Download draft PDF";
  }

  return "Download PDF";
}

export type { CompanyRecord, ServiceClientRecord };
