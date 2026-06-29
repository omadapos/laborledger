import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";
import { EmailService } from "../src/modules/email/email.service";
import type { EmailSendResult } from "../src/modules/email/email.types";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.VIN_DECODER = "stub";
process.env.EMAIL_PROVIDER = "resend";
process.env.RESEND_API_KEY = "re_test_key";
process.env.INVOICE_FROM_EMAIL = "billing@example.com";
process.env.INVOICE_FROM_NAME = "LaborLedger Billing";
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
const KNOWN_VIN = "1HGBH41JXMN109186";

describe("EMAIL02 invoice delivery with resend provider", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;
  let emailService: EmailService;
  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();
    emailService = app.get(EmailService);
    sendSpy = vi.spyOn(emailService, "send");
  });

  beforeEach(async () => {
    sendSpy.mockReset();
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    sendSpy.mockRestore();
    await app.close();
    await prisma.$disconnect();
  });

  it("records resend provider message id on successful invoice email delivery", async () => {
    sendSpy.mockResolvedValue({
      success: true,
      provider: "resend",
      providerMessageId: "msg_resend_success"
    } satisfies EmailSendResult);

    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);
    const seed = await seedCompletedWorkOrder(httpServer, adminSession, setup.companyId);

    const draft = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/client-invoices`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [seed.workOrderId]
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/issue`)
      .set("Cookie", adminSession)
      .send({})
      .expect(201);

    const sent = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/send-email`)
      .set("Cookie", adminSession)
      .send({ recipientEmail: "billing@client.example" })
      .expect(201);

    expect(sent.body.provider).toBe("resend");
    expect(sent.body.providerMessageId).toBe("msg_resend_success");
    expect(sent.body.status).toBe("SENT");
    expect(sendSpy).toHaveBeenCalledOnce();
  });

  it("records failed resend delivery safely without leaking secrets", async () => {
    sendSpy.mockResolvedValue({
      success: false,
      provider: "resend",
      errorMessage: "Resend rejected recipient."
    } satisfies EmailSendResult);

    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);
    const seed = await seedCompletedWorkOrder(httpServer, adminSession, setup.companyId);

    const draft = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/client-invoices`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [seed.workOrderId]
      })
      .expect(201);

    const issued = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/issue`)
      .set("Cookie", adminSession)
      .send({})
      .expect(201);

    const failed = await request(httpServer)
      .post(`/company-operations/client-invoices/${issued.body.id}/send-email`)
      .set("Cookie", adminSession)
      .send({ recipientEmail: "billing@client.example" })
      .expect(400);

    expect(failed.body.message).toBe("Resend rejected recipient.");
    expect(JSON.stringify(failed.body)).not.toContain("re_test_key");

    const delivery = await prisma.clientInvoiceDelivery.findFirst({
      where: { clientInvoiceId: issued.body.id }
    });

    expect(delivery?.status).toBe("FAILED");
    expect(delivery?.provider).toBe("resend");
    expect(delivery?.errorMessage).toBe("Resend rejected recipient.");
  });

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const raw = (response.headers["set-cookie"] as string[] | undefined)?.find((value) =>
      value.startsWith("laborledger.sid=")
    );
    return raw?.split(";")[0] ?? "";
  }

  async function createCompanyWithAdmin(
    superadminSession: string,
    label: string,
    slug: string
  ) {
    const adminEmail = `${slug}-${randomBytes(3).toString("hex")}@example.com`;
    const adminPassword = "AdminTemp!123";

    const created = await request(httpServer)
      .post("/platform/customers")
      .set("Cookie", superadminSession)
      .send({
        customerName: label,
        companyName: `${label} Main Shop`,
        ownerFullName: `${label} Owner`,
        ownerEmail: adminEmail,
        ownerPassword: adminPassword
      })
      .expect(201);

    return {
      companyId: created.body.company.id as string,
      adminEmail,
      adminPassword
    };
  }

  async function seedCompletedWorkOrder(
    server: ReturnType<INestApplication["getHttpServer"]>,
    session: string,
    companyId: string
  ) {
    const clientResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", session)
      .send({ name: "Client A" })
      .expect(201);

    const locationResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", session)
      .send({
        serviceClientId: clientResponse.body.id,
        name: "Location A",
        timezone: "America/New_York"
      })
      .expect(201);

    const vehicleResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/vehicles`)
      .set("Cookie", session)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id
      })
      .expect(201);

    const catalogResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", session)
      .send({ name: "Oil Change", fixedPriceMinor: 9900 })
      .expect(201);

    const employee = await request(server)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", session)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    const workOrder = await request(server)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", session)
      .send({
        vehicleId: vehicleResponse.body.id,
        serviceCatalogItemIds: [catalogResponse.body.id]
      })
      .expect(201);

    const assigned = await request(server)
      .post(`/company-operations/work-orders/${workOrder.body.id}/assignments`)
      .set("Cookie", session)
      .send({ employeeId: employee.body.id })
      .expect(201);

    await request(server)
      .post("/worker/scan")
      .send({
        companyId,
        pin: "123456",
        workOrderId: workOrder.body.id,
        workOrderAssignmentId: assigned.body.activeAssignmentId,
        enteredVin: KNOWN_VIN
      })
      .expect(201);

    const serviceLineId = (workOrder.body.serviceLines as Array<{ id: string }>)[0].id;

    await request(server)
      .post(`/worker/service-lines/${serviceLineId}/complete`)
      .send({ companyId, pin: "123456" })
      .expect(201);

    return {
      serviceClientId: clientResponse.body.id as string,
      workOrderId: workOrder.body.id as string
    };
  }
});
