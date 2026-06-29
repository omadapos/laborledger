import "reflect-metadata";

import { randomBytes, randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("shift review and approval", () => {
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

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("lists clocked-out shifts in the review queue and approves a clean shift", async () => {
    const fixture = await createReviewFixture();
    const headers = kioskHeaders(fixture.kiosk.id, fixture.kioskSecret);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:50:00.000Z"));

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

    const listResponse = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/review-shifts`)
      .set("Cookie", fixture.adminSession)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].displayStatus).toBe("needs_review");
    expect(listResponse.body[0].workedMinutes).toBe(460);
    expect(listResponse.body[0].warnings.some((warning: { code: string }) => warning.code === "early_clock_in")).toBe(
      true
    );

    const shiftId = listResponse.body[0].shiftId as string;

    const approveResponse = await request(httpServer)
      .post(`/company-operations/shifts/${shiftId}/approve`)
      .set("Cookie", fixture.adminSession)
      .expect(201);

    expect(approveResponse.body.displayStatus).toBe("approved");
    expect(approveResponse.body.approvedAt).toBeTruthy();
  });

  it("rejects approval when clock-out is missing", async () => {
    const fixture = await createReviewFixture();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T13:00:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kiosk.id, fixture.kioskSecret))
      .send({ pin: "123456", action: "clock_in", idempotencyKey: randomUUID() })
      .expect(201);

    vi.useRealTimers();

    const shift = await prisma.shift.findFirstOrThrow({ where: { companyId: fixture.companyId } });

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/approve`)
      .set("Cookie", fixture.adminSession)
      .expect(400);
  });

  it("rejects approval when break is open", async () => {
    const fixture = await createReviewFixture();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T13:00:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kiosk.id, fixture.kioskSecret))
      .send({ pin: "123456", action: "clock_in", idempotencyKey: randomUUID() })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T17:00:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kiosk.id, fixture.kioskSecret))
      .send({ pin: "123456", action: "break_start", idempotencyKey: randomUUID() })
      .expect(201);

    vi.useRealTimers();

    const shift = await prisma.shift.findFirstOrThrow({ where: { companyId: fixture.companyId } });

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/approve`)
      .set("Cookie", fixture.adminSession)
      .expect(400);
  });

  it("requires explicit additional-time approval before shift approval", async () => {
    const fixture = await createReviewFixture();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T13:00:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kiosk.id, fixture.kioskSecret))
      .send({ pin: "123456", action: "clock_in", idempotencyKey: randomUUID() })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T17:00:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kiosk.id, fixture.kioskSecret))
      .send({ pin: "123456", action: "break_start", idempotencyKey: randomUUID() })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T17:30:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kiosk.id, fixture.kioskSecret))
      .send({ pin: "123456", action: "break_end", idempotencyKey: randomUUID() })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T21:30:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kiosk.id, fixture.kioskSecret))
      .send({ pin: "123456", action: "clock_out", idempotencyKey: randomUUID() })
      .expect(201);

    vi.useRealTimers();

    const shift = await prisma.shift.findFirstOrThrow({ where: { companyId: fixture.companyId } });

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/approve`)
      .set("Cookie", fixture.adminSession)
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/approve-additional-time`)
      .set("Cookie", fixture.adminSession)
      .expect(201);

    const approveResponse = await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/approve`)
      .set("Cookie", fixture.adminSession)
      .expect(201);

    expect(approveResponse.body.displayStatus).toBe("approved");
    expect(approveResponse.body.payableMinutes).toBe(480);
  });

  it("scopes review access to the company administrator session", async () => {
    const alpha = await createReviewFixture("Alpha");
    const beta = await createReviewFixture("Beta");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T13:00:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(alpha.kiosk.id, alpha.kioskSecret))
      .send({ pin: "123456", action: "clock_in", idempotencyKey: randomUUID() })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T17:00:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(alpha.kiosk.id, alpha.kioskSecret))
      .send({ pin: "123456", action: "break_start", idempotencyKey: randomUUID() })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T17:30:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(alpha.kiosk.id, alpha.kioskSecret))
      .send({ pin: "123456", action: "break_end", idempotencyKey: randomUUID() })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T21:00:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(alpha.kiosk.id, alpha.kioskSecret))
      .send({ pin: "123456", action: "clock_out", idempotencyKey: randomUUID() })
      .expect(201);

    vi.useRealTimers();

    const alphaShift = await prisma.shift.findFirstOrThrow({ where: { companyId: alpha.companyId } });

    await request(httpServer)
      .post(`/company-operations/shifts/${alphaShift.id}/approve`)
      .set("Cookie", beta.adminSession)
      .expect(403);
  });

  async function createReviewFixture(label = "Alpha") {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setup = await createCompanyWithAdmin(superadminSession, label, `${label.toLowerCase()}-admin`);
    const adminSession = await login(setup.adminEmail, setup.adminPassword);

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: `${label} Client` })
      .expect(201);

    const locationResponse = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        name: `${label} Site`,
        timezone: "America/New_York",
        serviceClientId: clientResponse.body.id
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    const employee = await prisma.employee.findFirstOrThrow({
      where: { companyId: setup.companyId, fullName: "Maria Gomez" }
    });

    await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/shifts`)
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
        companyId: setup.companyId,
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

    return {
      companyId: setup.companyId,
      adminSession,
      kiosk,
      kioskSecret
    };
  }

  function kioskHeaders(kioskId: string, kioskSecret: string) {
    return {
      "x-kiosk-id": kioskId,
      "x-kiosk-secret": kioskSecret
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
      .send({ name: `${groupLabel} Group`, ownerEmail })
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

    const companyResponse = await request(httpServer)
      .post(`/groups/${groupResponse.body.group.id as string}/companies`)
      .set("Cookie", ownerSession)
      .send({ name: `${groupLabel} Company`, adminEmail })
      .expect(201);

    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;

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
