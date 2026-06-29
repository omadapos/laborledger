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

describe("PDF02 invoice PDF export and email attachments", () => {
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
    sendSpy.mockClear();
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    sendSpy.mockRestore();
    await app.close();
    await prisma.$disconnect();
  });

  it("downloads issued invoice PDF with safe content-disposition filename", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);
    const issuedInvoiceId = await issueInvoice(httpServer, adminSession, setup.companyId);

    const beforeTotal = (
      await prisma.clientInvoice.findUniqueOrThrow({ where: { id: issuedInvoiceId } })
    ).totalMinor;

    const response = await request(httpServer)
      .get(`/company-operations/client-invoices/${issuedInvoiceId}/pdf`)
      .set("Cookie", adminSession)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on("data", (chunk) => data.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(data)));
      })
      .expect(200);

    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(String(response.headers["content-disposition"])).toMatch(/invoice-INV-/);
    expect(response.body.subarray(0, 4).toString("utf8")).toBe("%PDF");

    const afterTotal = (
      await prisma.clientInvoice.findUniqueOrThrow({ where: { id: issuedInvoiceId } })
    ).totalMinor;
    expect(afterTotal).toBe(beforeTotal);
  });

  it("allows draft invoice PDF download", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);
    const draftId = await createDraftInvoice(httpServer, adminSession, setup.companyId);

    const response = await request(httpServer)
      .get(`/company-operations/client-invoices/${draftId}/pdf`)
      .set("Cookie", adminSession)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on("data", (chunk) => data.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(data)));
      })
      .expect(200);

    expect(response.body.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(String(response.headers["content-disposition"])).toContain("draft-");
  });

  it("rejects cross-company PDF access", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);
    const adminBSession = await login(setupB.adminEmail, setupB.adminPassword);
    const issuedInvoiceId = await issueInvoice(httpServer, adminASession, setupA.companyId);

    await request(httpServer)
      .get(`/company-operations/client-invoices/${issuedInvoiceId}/pdf`)
      .set("Cookie", adminBSession)
      .expect(403);
  });

  it("sends invoice email with PDF attachment through EmailService", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);
    const issuedInvoiceId = await issueInvoice(httpServer, adminSession, setup.companyId);

    await request(httpServer)
      .post(`/company-operations/client-invoices/${issuedInvoiceId}/send-email`)
      .set("Cookie", adminSession)
      .send({ recipientEmail: "billing@client.example" })
      .expect(201);

    expect(sendSpy).toHaveBeenCalledOnce();
    const message = sendSpy.mock.calls[0]?.[0];
    expect(message?.attachments).toHaveLength(1);
    expect(message?.attachments?.[0]?.filename).toMatch(/^invoice-/);
    expect(message?.attachments?.[0]?.contentType).toBe("application/pdf");
    expect(Buffer.isBuffer(message?.attachments?.[0]?.content)).toBe(true);
    expect(message?.attachments?.[0]?.content.subarray(0, 4).toString("utf8")).toBe("%PDF");
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

  async function createDraftInvoice(
    server: ReturnType<INestApplication["getHttpServer"]>,
    session: string,
    companyId: string
  ) {
    const seed = await seedCompletedWorkOrder(server, session, companyId);
    const draft = await request(server)
      .post(`/company-operations/companies/${companyId}/client-invoices`)
      .set("Cookie", session)
      .send({
        serviceClientId: seed.serviceClientId,
        workOrderIds: [seed.workOrderId]
      })
      .expect(201);

    return draft.body.id as string;
  }

  async function issueInvoice(
    server: ReturnType<INestApplication["getHttpServer"]>,
    session: string,
    companyId: string
  ) {
    const draftId = await createDraftInvoice(server, session, companyId);
    const issued = await request(server)
      .post(`/company-operations/client-invoices/${draftId}/issue`)
      .set("Cookie", session)
      .send({})
      .expect(201);

    return issued.body.id as string;
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
