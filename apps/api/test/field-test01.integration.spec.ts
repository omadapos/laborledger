import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { CompanyRole, MembershipStatus, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ARGON2_OPTIONS, resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";
import { EmailService } from "../src/modules/email/email.service";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.VIN_DECODER = "stub";
process.env.EMAIL_PROVIDER = "console";
process.env.INVOICE_FROM_EMAIL = "billing@example.com";
process.env.INVOICE_FROM_NAME = "LaborLedger Billing";
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
const HONDA_CRV_VIN = "5J6RM4H75DL028637";
/** Product requires 6-digit PINs; 4-digit test PIN from slice brief is rejected. */
const WORKER_PIN = "123456";

/** FIELD-TEST01 — API-level full-system smoke path (validation slice). */
describe("FIELD-TEST01 full system smoke path", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;
  let emailService: EmailService;
  let emailSendSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();
    emailService = app.get(EmailService);
    emailSendSpy = vi.spyOn(emailService, "send");
  });

  beforeEach(async () => {
    emailSendSpy.mockClear();
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    emailSendSpy.mockRestore();
    await app.close();
    await prisma.$disconnect();
  });

  it("executes platform onboarding through suspend/reactivate for Field Test Auto Services", async () => {
  const evidence: Record<string, unknown> = {};

  // --- A. Platform / customer lifecycle ---
  const superadminSession = await login(
    process.env.PLATFORM_SUPERADMIN_EMAIL as string,
    process.env.PLATFORM_SUPERADMIN_PASSWORD as string
  );

  const ownerEmail = `owner+fieldtest-${randomBytes(3).toString("hex")}@example.com`;
  const ownerPassword = "OwnerFieldTest!123";

  const customer = await request(httpServer)
    .post("/platform/customers")
    .set("Cookie", superadminSession)
    .send({
      customerName: "Field Test Auto Services",
      companyName: "Field Test Miami",
      ownerFullName: "Field Test Owner",
      ownerEmail,
      ownerPassword
    })
    .expect(201);

  const groupId = customer.body.customer.id as string;
  const companyId = customer.body.company.id as string;
  evidence.groupId = groupId;
  evidence.companyId = companyId;

  const platformList = await request(httpServer)
    .get("/platform/customers")
    .set("Cookie", superadminSession)
    .expect(200);
  expect(platformList.body[0].lifecycleStatus).toBe("ACTIVE");

  const ownerSession = await login(ownerEmail, ownerPassword);
  const ownerMe = await request(httpServer).get("/auth/me").set("Cookie", ownerSession).expect(200);
  expect(ownerMe.body.accessibleCompanies).toHaveLength(1);
  expect(ownerMe.body.accessibleCompanies[0].id).toBe(companyId);

  const adminSession = ownerSession;

  // --- B. Users / supervisor access ---
  const supervisorEmail = `supervisor+fieldtest-${randomBytes(3).toString("hex")}@example.com`;
  const supervisorPassword = `Super!${randomBytes(4).toString("hex")}`;
  const supervisorUser = await prisma.user.create({
    data: {
      email: supervisorEmail,
      passwordHash: await argon2.hash(supervisorPassword, ARGON2_OPTIONS),
      fullName: "Field Test Supervisor"
    }
  });
  await prisma.companyMembership.create({
    data: {
      companyId,
      userId: supervisorUser.id,
      email: supervisorEmail,
      role: CompanyRole.SUPERVISOR,
      status: MembershipStatus.ACTIVE
    }
  });
  const supervisorSession = await login(supervisorEmail, supervisorPassword);

  // --- C. Company setup ---
  const client = await request(httpServer)
    .post(`/company-operations/companies/${companyId}/service-clients`)
    .set("Cookie", adminSession)
    .send({ name: "Hertz Test Client" })
    .expect(201);

  const location = await request(httpServer)
    .post(`/company-operations/companies/${companyId}/locations`)
    .set("Cookie", adminSession)
    .send({
      serviceClientId: client.body.id,
      name: "Miami Airport Lot A",
      timezone: "America/New_York"
    })
    .expect(201);

  const employee = await request(httpServer)
    .post(`/company-operations/companies/${companyId}/employees`)
    .set("Cookie", adminSession)
    .send({ fullName: "Carlos Field Test", pin: WORKER_PIN })
    .expect(201);
  expect(employee.body.fullName).toBe("Carlos Field Test");

  const services = await Promise.all(
    [
      { name: "Basic wash", fixedPriceMinor: 2500 },
      { name: "Interior detail", fixedPriceMinor: 7500 },
      { name: "Smoke odor removal", fixedPriceMinor: 12000 },
      { name: "Pre-rental inspection", fixedPriceMinor: 3500 }
    ].map((item) =>
      request(httpServer)
        .post(`/company-operations/companies/${companyId}/service-catalog`)
        .set("Cookie", adminSession)
        .send(item)
        .expect(201)
    )
  );

  const assignSupervisor = await request(httpServer)
    .post(
      `/company-operations/companies/${companyId}/supervisors/${supervisorUser.id}/locations`
    )
    .set("Cookie", adminSession)
    .send({ locationId: location.body.id })
    .expect(201);
  expect(assignSupervisor.body.locationId).toBe(location.body.id);

  const supervisors = await request(httpServer)
    .get(`/company-operations/companies/${companyId}/supervisors`)
    .set("Cookie", adminSession)
    .expect(200);
  expect(supervisors.body[0].assignedLocationCount).toBe(1);

  await request(httpServer)
    .post(
      `/company-operations/companies/${companyId}/supervisors/${supervisorUser.id}/locations`
    )
    .set("Cookie", supervisorSession)
    .send({ locationId: location.body.id })
    .expect(403);

  // --- D. Vehicle intake / VIN decode ---
  await request(httpServer)
    .post(`/company-operations/companies/${companyId}/vehicles`)
    .set("Cookie", adminSession)
    .send({
      serviceClientId: client.body.id,
      locationId: location.body.id
    })
    .expect(400);

  const decode = await request(httpServer)
    .post("/company-operations/vehicles/decode-vin")
    .set("Cookie", adminSession)
    .send({ vin: HONDA_CRV_VIN })
    .expect(201);
  expect(decode.body.vin).toBe(HONDA_CRV_VIN);
  expect(decode.body.decodeSource).toBe("STUB");
  evidence.vinDecodeSource = decode.body.decodeSource;

  const vehicle = await request(httpServer)
    .post(`/company-operations/companies/${companyId}/vehicles`)
    .set("Cookie", adminSession)
    .send({
      vin: HONDA_CRV_VIN,
      serviceClientId: client.body.id,
      locationId: location.body.id
    })
    .expect(201);
  expect(vehicle.body.vin).toBe(HONDA_CRV_VIN);

  // --- E. Work order ---
  const workOrder = await request(httpServer)
    .post(`/company-operations/companies/${companyId}/work-orders`)
    .set("Cookie", adminSession)
    .send({
      vehicleId: vehicle.body.id,
      serviceCatalogItemIds: services.map((s) => s.body.id)
    })
    .expect(201);
  evidence.workOrderId = workOrder.body.id;

  await request(httpServer)
    .post(`/company-operations/work-orders/${workOrder.body.id}`)
    .set("Cookie", adminSession)
    .send({ status: "READY" })
    .expect(201);

  const assignment = await request(httpServer)
    .post(`/company-operations/work-orders/${workOrder.body.id}/assignments`)
    .set("Cookie", adminSession)
    .send({ employeeId: employee.body.id })
    .expect(201);
  expect(assignment.body.activeAssignmentId).toBeTruthy();

  // --- F. Worker PWA (API) ---
  const lookup = await request(httpServer)
    .post("/worker/lookup")
    .send({ companyId, pin: WORKER_PIN })
    .expect(201);
  expect(lookup.body.employee.fullName).toBe("Carlos Field Test");
  expect(lookup.body.assignments).toHaveLength(1);

  const scan = await request(httpServer)
    .post("/worker/scan")
    .send({
      companyId,
      pin: WORKER_PIN,
      workOrderId: workOrder.body.id,
      workOrderAssignmentId: assignment.body.activeAssignmentId,
      enteredVin: HONDA_CRV_VIN,
      idempotencyKey: "field-test-scan-1"
    })
    .expect(201);
  expect(scan.body.accepted).toBe(true);

  const serviceLineIds = (workOrder.body.serviceLines as Array<{ id: string }>).map((line) => line.id);
  for (const serviceLineId of serviceLineIds) {
    await request(httpServer)
      .post(`/worker/service-lines/${serviceLineId}/complete`)
      .send({ companyId, pin: WORKER_PIN })
      .expect(201);
  }

  // --- G. Admin completion review ---
  const completedDetail = await request(httpServer)
    .get(`/company-operations/work-orders/${workOrder.body.id}`)
    .set("Cookie", adminSession)
    .expect(200);
  expect(completedDetail.body.status).toBe("COMPLETED");
  expect(completedDetail.body.completedServiceLineCount).toBe(4);
  expect(completedDetail.body.lastResponsibilityConfirmation?.enteredVin).toBe(HONDA_CRV_VIN);

  // --- H. Invoice / PDF / email ---
  const draft = await request(httpServer)
    .post(`/company-operations/companies/${companyId}/client-invoices`)
    .set("Cookie", adminSession)
    .send({
      serviceClientId: client.body.id,
      workOrderIds: [workOrder.body.id]
    })
    .expect(201);
  expect(draft.body.totalMinor).toBe(25500);

  const issued = await request(httpServer)
    .post(`/company-operations/client-invoices/${draft.body.id}/issue`)
    .set("Cookie", adminSession)
    .send({})
    .expect(201);
  expect(issued.body.invoiceNumber).toMatch(/^INV-/);
  evidence.invoiceNumber = issued.body.invoiceNumber;

  const pdf = await request(httpServer)
    .get(`/company-operations/client-invoices/${draft.body.id}/pdf`)
    .set("Cookie", adminSession)
    .buffer(true)
    .parse((res, callback) => {
      const data: Buffer[] = [];
      res.on("data", (chunk) => data.push(Buffer.from(chunk)));
      res.on("end", () => callback(null, Buffer.concat(data)));
    })
    .expect(200);
  expect(pdf.body.subarray(0, 4).toString("utf8")).toBe("%PDF");

  const emailSend = await request(httpServer)
    .post(`/company-operations/client-invoices/${draft.body.id}/send-email`)
    .set("Cookie", adminSession)
    .send({ recipientEmail: "client-billing@example.com" })
    .expect(201);
  expect(emailSend.body.status).toBe("SENT");
  expect(emailSendSpy).toHaveBeenCalled();
  const lastEmail = emailSendSpy.mock.calls.at(-1)?.[0] as { attachments?: Array<{ filename: string }> };
  expect(lastEmail.attachments?.[0]?.filename).toMatch(/\.pdf$/u);

  const invoiceDetail = await request(httpServer)
    .get(`/company-operations/client-invoices/${draft.body.id}`)
    .set("Cookie", adminSession)
    .expect(200);
  expect(invoiceDetail.body.deliveries[0].status).toBe("SENT");

  // --- I. Reports ---
  const today = new Date().toISOString().slice(0, 10);
  const report = await request(httpServer)
    .get(
      `/company-operations/companies/${companyId}/reports/operations-summary?from=${today}&to=${today}`
    )
    .set("Cookie", adminSession)
    .expect(200);
  expect(report.body.kpis.completedVehicles).toBeGreaterThanOrEqual(1);
  expect(report.body.kpis.completedServiceLines).toBeGreaterThanOrEqual(4);
  expect(report.body.kpis.issuedInvoiceCount).toBe(1);
  expect(report.body.kpis.invoicedRevenueMinor).toBe(25500);
  expect(report.body.employees[0].completedServiceLineCount).toBeGreaterThanOrEqual(4);
  evidence.reportRevenueMinor = report.body.kpis.invoicedRevenueMinor;

  // --- J. Scheduling ---
  const shiftA = await request(httpServer)
    .post(`/company-operations/companies/${companyId}/shifts`)
    .set("Cookie", adminSession)
    .send({
      employeeId: employee.body.id,
      serviceClientId: client.body.id,
      locationId: location.body.id,
      scheduledStartUtc: "2026-07-07T13:00:00.000Z",
      scheduledEndUtc: "2026-07-07T21:00:00.000Z"
    })
    .expect(201);

  await request(httpServer)
    .post(`/company-operations/shifts/${shiftA.body.id}`)
    .set("Cookie", adminSession)
    .send({
      scheduledStartUtc: "2026-07-07T14:00:00.000Z",
      scheduledEndUtc: "2026-07-07T22:00:00.000Z"
    })
    .expect(201);

  const shiftB = await request(httpServer)
    .post(`/company-operations/companies/${companyId}/shifts`)
    .set("Cookie", adminSession)
    .send({
      employeeId: employee.body.id,
      serviceClientId: client.body.id,
      locationId: location.body.id,
      scheduledStartUtc: "2026-07-08T13:00:00.000Z",
      scheduledEndUtc: "2026-07-08T21:00:00.000Z"
    })
    .expect(201);

  await request(httpServer)
    .post(`/company-operations/shifts/${shiftB.body.id}/cancel`)
    .set("Cookie", adminSession)
    .send({ cancelReason: "Field test cancel" })
    .expect(201);

  const shiftsDefault = await request(httpServer)
    .get(
      `/company-operations/companies/${companyId}/shifts?from=2026-07-01&to=2026-07-31`
    )
    .set("Cookie", adminSession)
    .expect(200);
  expect(shiftsDefault.body.some((row: { id: string }) => row.id === shiftB.body.id)).toBe(false);

  const shiftsWithCancelled = await request(httpServer)
    .get(
      `/company-operations/companies/${companyId}/shifts?from=2026-07-01&to=2026-07-31&includeCancelled=true`
    )
    .set("Cookie", adminSession)
    .expect(200);
  expect(shiftsWithCancelled.body.some((row: { id: string }) => row.id === shiftB.body.id)).toBe(true);

  const copyWeek = await request(httpServer)
    .post(`/company-operations/companies/${companyId}/shifts/copy-week`)
    .set("Cookie", adminSession)
    .send({
      sourceWeekStart: "2026-07-06",
      targetWeekStart: "2026-07-13"
    })
    .expect(201);
  expect(copyWeek.body.summary.createdCount).toBeGreaterThanOrEqual(1);

  await request(httpServer)
    .post(`/company-operations/companies/${companyId}/shifts/copy-week`)
    .set("Cookie", adminSession)
    .send({
      sourceWeekStart: "2026-07-06",
      targetWeekStart: "2026-07-13"
    })
    .expect(201);

  await request(httpServer)
    .post(`/company-operations/shifts/${shiftA.body.id}`)
    .set("Cookie", supervisorSession)
    .send({
      scheduledStartUtc: "2026-07-07T15:00:00.000Z",
      scheduledEndUtc: "2026-07-07T23:00:00.000Z"
    })
    .expect(403);

  // --- K. Platform suspend / reactivate ---
  await request(httpServer)
    .post(`/platform/customers/${groupId}/suspend`)
    .set("Cookie", superadminSession)
    .send({ reason: "FIELD-TEST01 suspend check" })
    .expect(200);

  const blockedLookup = await request(httpServer)
    .post("/worker/lookup")
    .send({ companyId, pin: WORKER_PIN });
  expect(blockedLookup.status).toBe(403);
  expect(JSON.stringify(blockedLookup.body)).toContain("ACCOUNT_SUSPENDED");

  const ownerWhileSuspended = await login(ownerEmail, ownerPassword);
  const meSuspended = await request(httpServer)
    .get("/auth/me")
    .set("Cookie", ownerWhileSuspended)
    .expect(200);
  expect(meSuspended.body.accessibleCompanies).toHaveLength(0);

  await request(httpServer)
    .post(`/platform/customers/${groupId}/reactivate`)
    .set("Cookie", superadminSession)
    .expect(200);

  const ownerRestored = await login(ownerEmail, ownerPassword);
  const meRestored = await request(httpServer)
    .get("/auth/me")
    .set("Cookie", ownerRestored)
    .expect(200);
  expect(meRestored.body.accessibleCompanies).toHaveLength(1);

  await request(httpServer)
    .post("/worker/lookup")
    .send({ companyId, pin: WORKER_PIN })
    .expect(201);

  expect(evidence).toMatchObject({
    groupId: expect.any(String),
    companyId: expect.any(String),
    workOrderId: expect.any(String),
    invoiceNumber: expect.stringMatching(/^INV-/),
    reportRevenueMinor: 25500
  });
  });

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const raw = (response.headers["set-cookie"] as string[] | undefined)?.find((value) =>
      value.startsWith("laborledger.sid=")
    );
    return raw?.split(";")[0] ?? "";
  }
});
