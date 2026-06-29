import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  CompanyRole,
  GroupStatus,
  MembershipStatus,
  PrismaClient
} from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";
import { EmailService } from "../src/modules/email/email.service";
import {
  buildClientInvoiceEmailBodies,
  buildClientInvoiceEmailSubject
} from "../src/modules/client-invoice-delivery/client-invoice-email-content";
import { buildCompanyProfileHeaderLines } from "../src/modules/company-operations/company-profile-display";

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

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

describe("COMP-PROFILE01 company profile and invoice headers", () => {
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

  it("lets owner/admin read and update company profile with normalization", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);

    const initial = await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/profile`)
      .set("Cookie", adminSession)
      .expect(200);

    expect(initial.body.name).toBe("Alpha Main Shop");
    expect(initial.body.legalName).toBeNull();

    const updated = await request(httpServer)
      .patch(`/company-operations/companies/${setup.companyId}/profile`)
      .set("Cookie", adminSession)
      .send({
        legalName: "  Alpha Fleet Services LLC  ",
        phone: " (555) 123-4567 ",
        billingEmail: " Billing@Alpha.Example ",
        primaryContactName: "Jordan Lee",
        addressLine1: "100 Service Lane",
        city: "Austin",
        stateRegion: "TX",
        postalCode: "78701",
        country: "United States",
        addressLine2: ""
      })
      .expect(200);

    expect(updated.body.legalName).toBe("Alpha Fleet Services LLC");
    expect(updated.body.billingEmail).toBe("billing@alpha.example");
    expect(updated.body.addressLine2).toBeNull();
  });

  it("rejects invalid billing email and cross-company profile updates", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);
    const adminBSession = await login(setupB.adminEmail, setupB.adminPassword);

    await request(httpServer)
      .patch(`/company-operations/companies/${setupA.companyId}/profile`)
      .set("Cookie", adminASession)
      .send({ billingEmail: "not-an-email" })
      .expect(400);

    await request(httpServer)
      .patch(`/company-operations/companies/${setupA.companyId}/profile`)
      .set("Cookie", adminBSession)
      .send({ legalName: "Blocked Update LLC" })
      .expect(403);
  });

  it("allows supervisors to read profile but not update it", async () => {
    const fixture = await createCompanyWithSupervisor();

    await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/profile`)
      .set("Cookie", fixture.supervisorSession)
      .expect(200);

    await request(httpServer)
      .patch(`/company-operations/companies/${fixture.companyId}/profile`)
      .set("Cookie", fixture.supervisorSession)
      .send({ legalName: "Supervisor Attempt LLC" })
      .expect(403);
  });

  it("blocks profile access for suspended groups", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);
    const company = await prisma.company.findUniqueOrThrow({ where: { id: setup.companyId } });

    await prisma.group.update({
      where: { id: company.groupId },
      data: { status: GroupStatus.SUSPENDED, suspendedAt: new Date(), suspendedReason: "Test suspend" }
    });

    await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/profile`)
      .set("Cookie", adminSession)
      .expect(403);
  });

  it("renders invoice PDF using saved profile and falls back to company name when profile is blank", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);

    await request(httpServer)
      .patch(`/company-operations/companies/${setup.companyId}/profile`)
      .set("Cookie", adminSession)
      .send({
        legalName: "Alpha Fleet Services LLC",
        addressLine1: "100 Service Lane",
        phone: "(555) 123-4567",
        billingEmail: "billing@alpha.example"
      })
      .expect(200);

    const issuedInvoiceId = await issueInvoice(httpServer, adminSession, setup.companyId);
    const beforeTotal = (
      await prisma.clientInvoice.findUniqueOrThrow({ where: { id: issuedInvoiceId } })
    ).totalMinor;

    const withProfile = await downloadInvoicePdf(httpServer, adminSession, issuedInvoiceId);
    expect(withProfile.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(withProfile.length).toBeGreaterThan(1500);

    const cleared = await request(httpServer)
      .patch(`/company-operations/companies/${setup.companyId}/profile`)
      .set("Cookie", adminSession)
      .send({
        legalName: null,
        phone: null,
        billingEmail: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        stateRegion: null,
        postalCode: null,
        country: null,
        primaryContactName: null
      })
      .expect(200);

    expect(cleared.body.legalName).toBeNull();
    expect(buildCompanyProfileHeaderLines({ name: cleared.body.name, ...cleared.body })).toEqual([
      "Alpha Main Shop"
    ]);

    const fallbackPdf = await downloadInvoicePdf(httpServer, adminSession, issuedInvoiceId);
    expect(fallbackPdf.subarray(0, 4).toString("utf8")).toBe("%PDF");

    const afterTotal = (
      await prisma.clientInvoice.findUniqueOrThrow({ where: { id: issuedInvoiceId } })
    ).totalMinor;
    expect(afterTotal).toBe(beforeTotal);
  });

  it("uses legal name and contact info in invoice email content", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);

    await request(httpServer)
      .patch(`/company-operations/companies/${setup.companyId}/profile`)
      .set("Cookie", adminSession)
      .send({
        legalName: "Alpha Fleet Services LLC",
        phone: "(555) 123-4567",
        billingEmail: "billing@alpha.example",
        primaryContactName: "Jordan Lee"
      })
      .expect(200);

    const issuedInvoiceId = await issueInvoice(httpServer, adminSession, setup.companyId);

    await request(httpServer)
      .post(`/company-operations/client-invoices/${issuedInvoiceId}/send-email`)
      .set("Cookie", adminSession)
      .send({ recipientEmail: "billing@client.example" })
      .expect(201);

    expect(sendSpy).toHaveBeenCalledOnce();
    const message = sendSpy.mock.calls[0]?.[0];
    expect(message?.subject).toContain("Alpha Fleet Services LLC");
    expect(message?.textBody).toContain("(555) 123-4567");
    expect(message?.textBody).toContain("billing@alpha.example");
    expect(message?.textBody).toContain("Jordan Lee");
    expect(message?.textBody?.toLowerCase()).toContain("does not process taxes");
  });

  it("keeps password-reset style emails independent of company profile display helpers", () => {
    const subject = buildClientInvoiceEmailSubject({
      invoiceNumber: "INV-1",
      companyName: "Alpha Fleet Services LLC"
    });
    const { textBody } = buildClientInvoiceEmailBodies({
      companyName: "Alpha Fleet Services LLC",
      serviceClientName: "Client A",
      invoiceNumber: "INV-1",
      issuedAt: new Date("2026-06-22T12:00:00.000Z"),
      subtotalMinor: 9900,
      taxMinor: 0,
      totalMinor: 9900,
      currencyCode: "USD",
      lines: [],
      contactPhone: "(555) 123-4567"
    });

    expect(subject).toBe("Invoice INV-1 from Alpha Fleet Services LLC");
    expect(textBody).toContain("Contact:");
    expect(textBody).not.toContain("reset your password");
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

  async function createCompanyWithSupervisor() {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);
    const supervisorEmail = `supervisor-${randomBytes(3).toString("hex")}@example.com`;
    const supervisorPassword = "Supervisor!123";

    const supervisorUser = await prisma.user.create({
      data: {
        email: supervisorEmail,
        passwordHash: await argon2.hash(supervisorPassword, ARGON2_OPTIONS),
        fullName: "Alpha Supervisor"
      }
    });

    await prisma.companyMembership.create({
      data: {
        companyId: setup.companyId,
        userId: supervisorUser.id,
        email: supervisorEmail,
        role: CompanyRole.SUPERVISOR,
        status: MembershipStatus.ACTIVE
      }
    });

    const supervisorSession = await login(supervisorEmail, supervisorPassword);

    await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/access-context`)
      .set("Cookie", supervisorSession)
      .expect(200);

    return {
      companyId: setup.companyId,
      adminSession,
      supervisorSession
    };
  }

  async function issueInvoice(
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

    const issued = await request(server)
      .post(`/company-operations/client-invoices/${draft.body.id}/issue`)
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

  async function downloadInvoicePdf(
    server: ReturnType<INestApplication["getHttpServer"]>,
    session: string,
    clientInvoiceId: string
  ) {
    const response = await request(server)
      .get(`/company-operations/client-invoices/${clientInvoiceId}/pdf`)
      .set("Cookie", session)
      .buffer(true)
      .parse((res, callback) => {
        const data: Buffer[] = [];
        res.on("data", (chunk) => data.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(data)));
      })
      .expect(200);

    return response.body as Buffer;
  }
});
