import { describe, expect, it } from "vitest";

import {
  buildClientInvoiceEmailBodies,
  buildClientInvoiceEmailSubject
} from "../src/modules/client-invoice-delivery/client-invoice-email-content";

describe("client-invoice-email-content", () => {
  const baseInput = {
    companyName: "Alpha Company",
    serviceClientName: "Client A",
    invoiceNumber: "INV-20260622-0001",
    issuedAt: new Date("2026-06-22T12:00:00.000Z"),
    subtotalMinor: 9900,
    taxMinor: 0,
    totalMinor: 9900,
    currencyCode: "USD",
    lines: [
      {
        workOrderNumberSnapshot: "WO-1",
        vinSnapshot: "1HGBH41JXMN109186",
        vehicleLabelSnapshot: "2020 Honda Civic",
        serviceNameSnapshot: "Oil Change",
        lineTotalMinor: 9900,
        currencyCode: "USD"
      }
    ]
  };

  it("builds invoice email subject with number and company", () => {
    expect(buildClientInvoiceEmailSubject(baseInput)).toBe(
      "Invoice INV-20260622-0001 from Alpha Company"
    );
    expect(
      buildClientInvoiceEmailSubject({
        invoiceNumber: "INV-20260622-0001",
        companyName: "Alpha Fleet Services LLC"
      })
    ).toBe("Invoice INV-20260622-0001 from Alpha Fleet Services LLC");
  });

  it("includes optional contact info when provided", () => {
    const { textBody } = buildClientInvoiceEmailBodies({
      ...baseInput,
      companyName: "Alpha Fleet Services LLC",
      contactPhone: "(555) 123-4567",
      contactBillingEmail: "billing@alpha.example",
      contactName: "Jordan Lee"
    });

    expect(textBody).toContain("Alpha Fleet Services LLC");
    expect(textBody).toContain("(555) 123-4567");
    expect(textBody).toContain("billing@alpha.example");
    expect(textBody).toContain("Jordan Lee");
  });

  it("includes invoice number, total, VIN, and disclaimer in body", () => {
    const { textBody } = buildClientInvoiceEmailBodies(baseInput);

    expect(textBody).toContain("INV-20260622-0001");
    expect(textBody).toContain("$99.00");
    expect(textBody).toContain("1HGBH41JXMN109186");
    expect(textBody).toContain("WO-1");
    expect(textBody.toLowerCase()).toContain("does not process taxes");
    expect(textBody.toLowerCase()).toContain("payments");
  });
});
