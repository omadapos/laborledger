import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.VIN_DECODER = "stub";
process.env.EMAIL_PROVIDER = "console";
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
const KNOWN_VIN = "1HGBH41JXMN109186";

describe("INV02 client invoice delivery foundation", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);

    });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("sends issued invoices by email, records delivery history, and enforces guards", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const seed = await seedCompletedWorkOrder(httpServer, adminASession, setupA.companyId);

    const draft = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/client-invoices`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [seed.workOrderId]
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/send-email`)
      .set("Cookie", adminASession)
      .send({ recipientEmail: "billing@client.example" })
      .expect(400);

    const issued = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/issue`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    const beforeSend = await prisma.clientInvoice.findUnique({ where: { id: draft.body.id } });
    const beforeTotal = beforeSend?.totalMinor;

    const sent = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/send-email`)
      .set("Cookie", adminASession)
      .send({
        recipientEmail: "billing@client.example",
        message: "Please review attached services."
      })
      .expect(201);

    expect(sent.body.status).toBe("SENT");
    expect(sent.body.provider).toBe("console");
    expect(sent.body.recipientEmail).toBe("billing@client.example");
    expect(sent.body.subject).toContain(issued.body.invoiceNumber);

    const detail = await request(httpServer)
      .get(`/company-operations/client-invoices/${draft.body.id}`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(detail.body.deliveries).toHaveLength(1);
    expect(detail.body.deliveries[0].status).toBe("SENT");

    const deliveries = await request(httpServer)
      .get(`/company-operations/client-invoices/${draft.body.id}/deliveries`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(deliveries.body).toHaveLength(1);

    await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/send-email`)
      .set("Cookie", adminASession)
      .send({ recipientEmail: "not-an-email" })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/send-email`)
      .set("Cookie", (await login(setupB.adminEmail, setupB.adminPassword)))
      .send({ recipientEmail: "billing@client.example" })
      .expect(403);

    const failed = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/send-email`)
      .set("Cookie", adminASession)
      .send({ recipientEmail: "ops@delivery-fail.test" })
      .expect(400);

    expect(String(failed.body.message ?? "")).toMatch(/fail/i);

    const failedDelivery = await prisma.clientInvoiceDelivery.findFirst({
      where: { clientInvoiceId: draft.body.id, status: "FAILED" }
    });
    expect(failedDelivery?.recipientEmail).toBe("ops@delivery-fail.test");
    expect(failedDelivery?.errorMessage).toBeTruthy();

    const voided = await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/void`)
      .set("Cookie", adminASession)
      .send({ voidReason: "Wrong client" })
      .expect(201);

    expect(voided.body.status).toBe("VOID");

    await request(httpServer)
      .post(`/company-operations/client-invoices/${draft.body.id}/send-email`)
      .set("Cookie", adminASession)
      .send({ recipientEmail: "billing@client.example" })
      .expect(400);

    const afterSend = await prisma.clientInvoice.findUnique({ where: { id: draft.body.id } });
    expect(afterSend?.totalMinor).toBe(beforeTotal);
    expect(afterSend?.invoiceNumber).toBe(issued.body.invoiceNumber);

    const paymentTables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN ('payments', 'payroll_runs', 'tax_records')`
    );
    expect(paymentTables).toHaveLength(0);
  });

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

  async function createCompanyWithAdmin(
    superadminSession: string,
    groupLabel: string,
    adminPrefix: string
  ) {
    const ownerEmail = `${groupLabel.toLowerCase()}-owner-${randomBytes(3).toString("hex")}@example.com`;
    const ownerPassword = `Owner!${randomBytes(4).toString("hex")}`;

    const groupResponse = await request(httpServer)
      .post("/platform/groups")
      .set("Cookie", superadminSession)
      .send({
        name: `${groupLabel} Group`,
        ownerEmail
      })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: groupResponse.body.invitationToken,
        password: ownerPassword,
        fullName: `${groupLabel} Owner`
      })
      .expect(200);

    const ownerSession = await login(ownerEmail, ownerPassword);

    const adminEmail = `${adminPrefix}-${randomBytes(3).toString("hex")}@example.com`;
    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;

    const companyResponse = await request(httpServer)
      .post(`/groups/${groupResponse.body.group.id as string}/companies`)
      .set("Cookie", ownerSession)
      .send({
        name: `${groupLabel} Company`,
        adminEmail
      })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: companyResponse.body.invitationToken,
        password: adminPassword,
        fullName: `${groupLabel} Admin`
      })
      .expect(200);

    return {
      companyId: companyResponse.body.company.id as string,
      adminEmail,
      adminPassword
    };
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const cookies = response.headers["set-cookie"] as string[] | undefined;
    expect(cookies && cookies.length > 0).toBe(true);
    return cookies?.[0] ?? "";
  }
});
