import "reflect-metadata";

import { randomBytes, randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ClientInvoiceStatus, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

const WEEK_START = "2026-04-06";

describe("labor pay billing", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();
  });

  beforeEach(async () => {
    vi.useRealTimers();
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("includes approved shifts in preview and excludes unapproved shifts", async () => {
    const fixture = await createFixture();
    const shiftId = await punchCompleteShift(fixture);

    const beforeApprove = await request(httpServer)
      .get(
        `/company-operations/companies/${fixture.companyId}/labor-pay-billing/preview?weekStart=${WEEK_START}`
      )
      .set("Cookie", fixture.adminSession)
      .expect(200);

    expect(beforeApprove.body.totals.approvedShiftCount).toBe(0);
    expect(beforeApprove.body.excludedShifts.length).toBeGreaterThan(0);

    await request(httpServer)
      .post(`/company-operations/shifts/${shiftId}/approve`)
      .set("Cookie", fixture.adminSession)
      .expect(201);

    const preview = await request(httpServer)
      .get(
        `/company-operations/companies/${fixture.companyId}/labor-pay-billing/preview?weekStart=${WEEK_START}`
      )
      .set("Cookie", fixture.adminSession)
      .expect(200);

    expect(preview.body.dataSource).toBe("live_approved");
    expect(preview.body.totals.approvedShiftCount).toBe(1);
    expect(preview.body.employeePayPrep).toHaveLength(1);
    expect(preview.body.clientLaborBilling).toHaveLength(1);
    expect(preview.body.totals.payableMinutes).toBeGreaterThan(0);
  });

  it("prefers closed snapshot totals when the week is closed", async () => {
    const fixture = await createFixture();
    const shiftId = await punchCompleteShift(fixture);

    await request(httpServer)
      .post(`/company-operations/shifts/${shiftId}/approve`)
      .set("Cookie", fixture.adminSession)
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/weekly-close`)
      .set("Cookie", fixture.adminSession)
      .send({ weekStart: WEEK_START })
      .expect(201);

    const preview = await request(httpServer)
      .get(
        `/company-operations/companies/${fixture.companyId}/labor-pay-billing/preview?weekStart=${WEEK_START}`
      )
      .set("Cookie", fixture.adminSession)
      .expect(200);

    expect(preview.body.dataSource).toBe("closed_snapshot");
    expect(preview.body.snapshotVersion).toBe(1);
    expect(preview.body.weekStatus).toBe("CLOSED");
  });

  it("returns empty preview when onlyClosedWeeks is set for an open week", async () => {
    const fixture = await createFixture();
    const shiftId = await punchCompleteShift(fixture);

    await request(httpServer)
      .post(`/company-operations/shifts/${shiftId}/approve`)
      .set("Cookie", fixture.adminSession)
      .expect(201);

    const preview = await request(httpServer)
      .get(
        `/company-operations/companies/${fixture.companyId}/labor-pay-billing/preview?weekStart=${WEEK_START}&onlyClosedWeeks=true`
      )
      .set("Cookie", fixture.adminSession)
      .expect(200);

    expect(preview.body.dataSource).toBe("none");
    expect(preview.body.employeePayPrep).toHaveLength(0);
  });

  it("exports filtered CSV and rejects cross-company access", async () => {
    const fixtureA = await createFixture("Alpha");
    const fixtureB = await createFixture("Beta");
    const shiftId = await punchCompleteShift(fixtureA);

    await request(httpServer)
      .post(`/company-operations/shifts/${shiftId}/approve`)
      .set("Cookie", fixtureA.adminSession)
      .expect(201);

    await request(httpServer)
      .get(
        `/company-operations/companies/${fixtureB.companyId}/labor-pay-billing/preview?weekStart=${WEEK_START}`
      )
      .set("Cookie", fixtureA.adminSession)
      .expect(403);

    const csv = await request(httpServer)
      .get(
        `/company-operations/companies/${fixtureA.companyId}/labor-pay-billing/payroll-csv?weekStart=${WEEK_START}`
      )
      .set("Cookie", fixtureA.adminSession)
      .expect(200);

    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("employee_name");
    expect(csv.text).toContain("Alpha Employee");
  });

  it("does not create invoices or drafts automatically", async () => {
    const fixture = await createFixture();
    const shiftId = await punchCompleteShift(fixture);

    await request(httpServer)
      .post(`/company-operations/shifts/${shiftId}/approve`)
      .set("Cookie", fixture.adminSession)
      .expect(201);

    await request(httpServer)
      .get(
        `/company-operations/companies/${fixture.companyId}/labor-pay-billing/preview?weekStart=${WEEK_START}`
      )
      .set("Cookie", fixture.adminSession)
      .expect(200);

    const invoiceCount = await prisma.clientInvoice.count({
      where: { companyId: fixture.companyId, status: ClientInvoiceStatus.ISSUED }
    });
    expect(invoiceCount).toBe(0);

    await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/labor-pay-billing/drafts`)
      .set("Cookie", fixture.adminSession)
      .expect(501);
  });

  async function punchCompleteShift(fixture: Awaited<ReturnType<typeof createFixture>>) {
    const headers = kioskHeaders(fixture.kiosk.id, fixture.kioskSecret);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T13:00:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({ pin: "123456", action: "clock_in", idempotencyKey: randomUUID() })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T17:00:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({ pin: "123456", action: "break_start", idempotencyKey: randomUUID() })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T17:30:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({ pin: "123456", action: "break_end", idempotencyKey: randomUUID() })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T21:00:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({ pin: "123456", action: "clock_out", idempotencyKey: randomUUID() })
      .expect(201);
    vi.useRealTimers();

    const shift = await prisma.shift.findFirstOrThrow({ where: { companyId: fixture.companyId } });
    return shift.id;
  }

  async function createFixture(label = "Labor") {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const ownerEmail = `${label.toLowerCase()}-owner-${randomBytes(3).toString("hex")}@example.com`;
    const ownerPassword = `Owner!${randomBytes(4).toString("hex")}`;
    const groupResponse = await request(httpServer)
      .post("/platform/groups")
      .set("Cookie", superadminSession)
      .send({ name: `${label} Group`, ownerEmail })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({ token: groupResponse.body.invitationToken, password: ownerPassword, fullName: `${label} Owner` })
      .expect(200);

    const ownerSession = await login(ownerEmail, ownerPassword);
    const adminEmail = `${label.toLowerCase()}-admin-${randomBytes(3).toString("hex")}@example.com`;
    const companyResponse = await request(httpServer)
      .post(`/groups/${groupResponse.body.group.id as string}/companies`)
      .set("Cookie", ownerSession)
      .send({ name: `${label} Company`, adminEmail })
      .expect(201);

    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;
    await request(httpServer)
      .post("/invitations/accept")
      .send({ token: companyResponse.body.invitationToken, password: adminPassword, fullName: `${label} Admin` })
      .expect(200);

    const adminSession = await login(adminEmail, adminPassword);
    const companyId = companyResponse.body.company.id as string;

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: `${label} Client` })
      .expect(201);

    const locationResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: clientResponse.body.id,
        name: `${label} Site`,
        timezone: "America/New_York"
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: `${label} Employee`, pin: "123456" })
      .expect(201);

    const employee = await prisma.employee.findFirstOrThrow({ where: { companyId } });

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/shifts`)
      .set("Cookie", adminSession)
      .send({
        employeeId: employee.id,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id,
        scheduledStartUtc: "2026-04-06T13:00:00.000Z",
        scheduledEndUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(201);

    const kioskSecret = `kiosk-${randomBytes(8).toString("hex")}`;
    const kiosk = await prisma.kiosk.create({
      data: {
        groupId: employee.groupId,
        companyId,
        locationId: locationResponse.body.id,
        name: `${label} Kiosk`
      }
    });

    await prisma.kioskCredential.create({
      data: {
        kioskId: kiosk.id,
        secretHash: await argon2.hash(kioskSecret, ARGON2_OPTIONS)
      }
    });

    return { companyId, adminSession, kiosk, kioskSecret };
  }

  function kioskHeaders(kioskId: string, kioskSecret: string) {
    return { "x-kiosk-id": kioskId, "x-kiosk-secret": kioskSecret };
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    return (response.headers["set-cookie"] as string[])[0];
  }
});
