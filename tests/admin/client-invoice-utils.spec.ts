import { describe, expect, it } from "vitest";

import {
  buildClientInvoicePdfPath,
  clientInvoiceDisclaimer,
  clientInvoicesEmptyMessage,
  clientInvoicePdfButtonLabel,
  formatClientInvoiceDeliverySummary,
  formatClientInvoiceLineSummary,
  formatClientInvoiceMoney,
  formatClientInvoiceNumberLabel,
  formatClientInvoiceStatusLabel,
  invoiceEmailSendDisabledCopy,
  invoicePrintHelperCopy,
  isValidInvoiceRecipientEmail,
  sumSelectedWorkOrderTotals
} from "../../apps/admin/src/lib/client-invoice-utils";

describe("client-invoice-utils", () => {
  it("formats invoice status labels and draft number fallback", () => {
    expect(formatClientInvoiceStatusLabel("DRAFT")).toBe("Draft");
    expect(formatClientInvoiceStatusLabel("ISSUED")).toBe("Issued");
    expect(formatClientInvoiceStatusLabel("VOID")).toBe("Void");
    expect(
      formatClientInvoiceNumberLabel({ invoiceNumber: "INV-20260621-0001", status: "ISSUED", id: "inv-1" })
    ).toBe("INV-20260621-0001");
    expect(formatClientInvoiceNumberLabel({ invoiceNumber: null, status: "DRAFT", id: "clinvoice123456789" })).toContain(
      "Draft"
    );
  });

  it("formats money and line summaries", () => {
    expect(formatClientInvoiceMoney(12500)).toBe("$125.00");
    expect(
      formatClientInvoiceLineSummary({
        id: "line-1",
        workOrderId: "wo-1",
        workOrderServiceLineId: "sl-1",
        vehicleId: "veh-1",
        workOrderNumberSnapshot: "WO-1",
        vinSnapshot: "1HGBH41JXMN109186",
        vehicleLabelSnapshot: "2020 Honda Civic",
        serviceNameSnapshot: "Oil Change",
        serviceCategorySnapshot: null,
        description: null,
        quantity: 1,
        unitPriceMinor: 9900,
        lineTotalMinor: 9900,
        currencyCode: "USD",
        createdAt: "2026-06-21T12:00:00.000Z"
      })
    ).toContain("Oil Change");
  });

  it("uses disclaimer that excludes payroll, tax, payment, and accounting", () => {
    const copy = clientInvoiceDisclaimer();
    expect(copy.toLowerCase()).toContain("not calculate payroll");
    expect(copy.toLowerCase()).toContain("taxes");
    expect(copy.toLowerCase()).toContain("payments");
    expect(copy.toLowerCase()).toContain("accounting");
  });

  it("provides empty and filtered empty helper copy", () => {
    expect(clientInvoicesEmptyMessage(false).title).toBe("No client invoices yet");
    expect(clientInvoicesEmptyMessage(true).title).toBe("No invoices match your filters");
  });

  it("validates recipient email and send-disabled copy", () => {
    expect(isValidInvoiceRecipientEmail("billing@client.example")).toBe(true);
    expect(isValidInvoiceRecipientEmail("bad-email")).toBe(false);
    expect(invoiceEmailSendDisabledCopy("DRAFT")).toContain("Issue invoice");
    expect(invoiceEmailSendDisabledCopy("VOID")).toContain("Voided");
    expect(invoiceEmailSendDisabledCopy("ISSUED")).toBeNull();
    expect(invoicePrintHelperCopy().toLowerCase()).toContain("print");
  });

  it("formats delivery status summaries", () => {
    expect(
      formatClientInvoiceDeliverySummary({
        id: "d1",
        channel: "email",
        recipientEmail: "billing@client.example",
        subject: "Invoice INV-1",
        status: "FAILED",
        provider: "console",
        providerMessageId: null,
        errorMessage: "Simulated failure",
        messageNote: null,
        sentAt: null,
        attemptedAt: "2026-06-22T12:00:00.000Z",
        createdAt: "2026-06-22T12:00:00.000Z"
      })
    ).toContain("billing@client.example");
  });

  it("sums selected invoiceable work order totals", () => {
    expect(
      sumSelectedWorkOrderTotals([
        {
          id: "wo-1",
          workOrderNumber: "WO-1",
          serviceClientId: "sc-1",
          vehicle: {
            id: "v1",
            vin: "VIN",
            year: null,
            make: null,
            model: null,
            plate: null
          },
          serviceLineCount: 1,
          totalServiceAmountMinor: 9900,
          currencyCode: "USD",
          serviceLines: []
        },
        {
          id: "wo-2",
          workOrderNumber: "WO-2",
          serviceClientId: "sc-1",
          vehicle: {
            id: "v2",
            vin: "VIN2",
            year: null,
            make: null,
            model: null,
            plate: null
          },
          serviceLineCount: 1,
          totalServiceAmountMinor: 4500,
          currencyCode: "USD",
          serviceLines: []
        }
      ])
    ).toBe(14400);
  });

  it("builds PDF download paths and button labels", () => {
    expect(buildClientInvoicePdfPath("inv-123")).toBe("/api/company-operations/client-invoices/inv-123/pdf");
    expect(clientInvoicePdfButtonLabel("DRAFT")).toBe("Download draft PDF");
    expect(clientInvoicePdfButtonLabel("ISSUED")).toBe("Download PDF");
  });
});
