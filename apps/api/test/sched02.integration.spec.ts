import "reflect-metadata";

import { randomBytes, randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
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

describe("SCHED02 scheduling hardening", () => {
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

  it("edits a future unstarted shift and audits the change", async () => {
    const fixture = await createSchedulingFixture();
    const shift = await createShift(fixture, {
      scheduledStartUtc: "2026-04-07T13:00:00.000Z",
      scheduledEndUtc: "2026-04-07T21:00:00.000Z"
    });

    const updated = await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}`)
      .set("Cookie", fixture.adminSession)
      .send({
        scheduledStartUtc: "2026-04-07T14:00:00.000Z",
        scheduledEndUtc: "2026-04-07T22:00:00.000Z"
      })
      .expect(201);

    expect(updated.body.scheduledStartUtc).toBe("2026-04-07T14:00:00.000Z");

    const audit = await prisma.auditEvent.findFirst({
      where: { action: "SHIFT_UPDATED", targetId: shift.id }
    });
    expect(audit).not.toBeNull();
  });

  it("rejects edit when shift overlaps another employee shift", async () => {
    const fixture = await createSchedulingFixture();
    await createShift(fixture, {
      scheduledStartUtc: "2026-04-06T13:00:00.000Z",
      scheduledEndUtc: "2026-04-06T21:00:00.000Z"
    });
    const shiftB = await createShift(fixture, {
      scheduledStartUtc: "2026-04-07T13:00:00.000Z",
      scheduledEndUtc: "2026-04-07T21:00:00.000Z"
    });

    await request(httpServer)
      .post(`/company-operations/shifts/${shiftB.id}`)
      .set("Cookie", fixture.adminSession)
      .send({
        scheduledStartUtc: "2026-04-06T14:00:00.000Z",
        scheduledEndUtc: "2026-04-06T18:00:00.000Z"
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain("already has a shift");
        expect(response.body.conflicts?.[0]?.conflictingShiftId).toBeTruthy();
      });
  });

  it("rejects edit for cancelled or punched shifts", async () => {
    const fixture = await createSchedulingFixture();
    const shift = await createShift(fixture);

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/cancel`)
      .set("Cookie", fixture.adminSession)
      .send({ cancelReason: "Weather closure" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}`)
      .set("Cookie", fixture.adminSession)
      .send({
        scheduledStartUtc: "2026-04-07T14:00:00.000Z",
        scheduledEndUtc: "2026-04-07T22:00:00.000Z"
      })
      .expect(400);

    const punchedFixture = await createSchedulingFixture("Beta");
    const punchedShift = await createShift(punchedFixture);
    await punchClockIn(punchedFixture, punchedShift.id);

    await request(httpServer)
      .post(`/company-operations/shifts/${punchedShift.id}`)
      .set("Cookie", punchedFixture.adminSession)
      .send({
        scheduledStartUtc: "2026-04-07T14:00:00.000Z",
        scheduledEndUtc: "2026-04-07T22:00:00.000Z"
      })
      .expect(400);
  });

  it("cancels a future shift with reason and hides it from default list", async () => {
    const fixture = await createSchedulingFixture();
    const shift = await createShift(fixture, {
      scheduledStartUtc: "2026-04-08T13:00:00.000Z",
      scheduledEndUtc: "2026-04-08T21:00:00.000Z"
    });

    const cancelled = await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/cancel`)
      .set("Cookie", fixture.adminSession)
      .send({ cancelReason: "Client site closed" })
      .expect(201);

    expect(cancelled.body.status).toBe("CANCELLED");
    expect(cancelled.body.cancelReason).toBe("Client site closed");

    const defaultList = await request(httpServer)
      .get(
        `/company-operations/companies/${fixture.companyId}/shifts?from=2026-04-01T00:00:00.000Z&to=2026-04-30T00:00:00.000Z`
      )
      .set("Cookie", fixture.adminSession)
      .expect(200);
    expect(defaultList.body.some((row: { id: string }) => row.id === shift.id)).toBe(false);

    const withCancelled = await request(httpServer)
      .get(
        `/company-operations/companies/${fixture.companyId}/shifts?from=2026-04-01T00:00:00.000Z&to=2026-04-30T00:00:00.000Z&includeCancelled=true`
      )
      .set("Cookie", fixture.adminSession)
      .expect(200);
    expect(withCancelled.body.some((row: { id: string }) => row.id === shift.id)).toBe(true);

    const audit = await prisma.auditEvent.findFirst({
      where: { action: "SHIFT_CANCELLED", targetId: shift.id }
    });
    expect(audit).not.toBeNull();
  });

  it("requires cancel reason and rejects cancel for punched shifts", async () => {
    const fixture = await createSchedulingFixture();
    const shift = await createShift(fixture);

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/cancel`)
      .set("Cookie", fixture.adminSession)
      .send({ cancelReason: "" })
      .expect(400);

    await punchClockIn(fixture, shift.id);

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/cancel`)
      .set("Cookie", fixture.adminSession)
      .send({ cancelReason: "Too late" })
      .expect(400);
  });

  it("blocks kiosk clock-in for cancelled shifts", async () => {
    const fixture = await createSchedulingFixture();
    const shift = await createShift(fixture);

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/cancel`)
      .set("Cookie", fixture.adminSession)
      .send({ cancelReason: "Cancelled before start" })
      .expect(201);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:50:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kioskId, fixture.kioskSecret))
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(404);
  });

  it("copies a week preserving local wall-clock times and reports conflicts", async () => {
    const fixture = await createSchedulingFixture();
    await createShift(fixture, {
      scheduledStartUtc: "2026-04-06T13:00:00.000Z",
      scheduledEndUtc: "2026-04-06T21:00:00.000Z"
    });
    await createShift(fixture, {
      scheduledStartUtc: "2026-04-07T13:00:00.000Z",
      scheduledEndUtc: "2026-04-07T21:00:00.000Z"
    });

    const firstCopy = await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/shifts/copy-week`)
      .set("Cookie", fixture.adminSession)
      .send({
        sourceWeekStart: "2026-04-06",
        targetWeekStart: "2026-04-13"
      })
      .expect(201);

    expect(firstCopy.body.summary.createdCount).toBe(2);
    expect(firstCopy.body.created[0]?.scheduledStartUtc).toBe("2026-04-13T13:00:00.000Z");

    await createShift(fixture, {
      scheduledStartUtc: "2026-04-20T13:00:00.000Z",
      scheduledEndUtc: "2026-04-20T21:00:00.000Z"
    });

    const secondCopy = await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/shifts/copy-week`)
      .set("Cookie", fixture.adminSession)
      .send({
        sourceWeekStart: "2026-04-06",
        targetWeekStart: "2026-04-20"
      })
      .expect(201);

    expect(secondCopy.body.summary.createdCount).toBe(1);
    expect(secondCopy.body.summary.conflictCount).toBe(1);

    const retry = await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/shifts/copy-week`)
      .set("Cookie", fixture.adminSession)
      .send({
        sourceWeekStart: "2026-04-06",
        targetWeekStart: "2026-04-13"
      })
      .expect(201);

    expect(retry.body.summary.createdCount).toBe(2);

    const audit = await prisma.auditEvent.findFirst({
      where: { action: "SHIFT_WEEK_COPIED" }
    });
    expect(audit).not.toBeNull();
  });

  it("blocks supervisors from edit, cancel, and copy-week", async () => {
    const fixture = await createSchedulingFixture();
    const shift = await createShift(fixture, {
      scheduledStartUtc: "2026-04-08T13:00:00.000Z",
      scheduledEndUtc: "2026-04-08T21:00:00.000Z"
    });

    const supervisorSession = await createSupervisorSession(fixture);

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}`)
      .set("Cookie", supervisorSession)
      .send({
        scheduledStartUtc: "2026-04-08T14:00:00.000Z",
        scheduledEndUtc: "2026-04-08T22:00:00.000Z"
      })
      .expect(403);

    await request(httpServer)
      .post(`/company-operations/shifts/${shift.id}/cancel`)
      .set("Cookie", supervisorSession)
      .send({ cancelReason: "Not allowed" })
      .expect(403);

    await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/shifts/copy-week`)
      .set("Cookie", supervisorSession)
      .send({
        sourceWeekStart: "2026-04-06",
        targetWeekStart: "2026-04-13"
      })
      .expect(403);
  });

  async function createSchedulingFixture(label = "Alpha") {
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

    const employeeResponse = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    const kioskSecret = `kiosk-${randomBytes(8).toString("hex")}`;
    const kiosk = await prisma.kiosk.create({
      data: {
        groupId: (await prisma.company.findUniqueOrThrow({ where: { id: setup.companyId } })).groupId,
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
      clientId: clientResponse.body.id as string,
      locationId: locationResponse.body.id as string,
      employeeId: employeeResponse.body.id as string,
      kioskId: kiosk.id,
      kioskSecret
    };
  }

  async function createShift(
    fixture: Awaited<ReturnType<typeof createSchedulingFixture>>,
    input?: { scheduledStartUtc: string; scheduledEndUtc: string }
  ) {
    const response = await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/shifts`)
      .set("Cookie", fixture.adminSession)
      .send({
        employeeId: fixture.employeeId,
        serviceClientId: fixture.clientId,
        locationId: fixture.locationId,
        scheduledStartUtc: input?.scheduledStartUtc ?? "2026-04-06T13:00:00.000Z",
        scheduledEndUtc: input?.scheduledEndUtc ?? "2026-04-06T21:00:00.000Z"
      })
      .expect(201);

    return response.body as { id: string };
  }

  async function punchClockIn(fixture: Awaited<ReturnType<typeof createSchedulingFixture>>, _shiftId: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:50:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kioskId, fixture.kioskSecret))
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(201);
    vi.useRealTimers();
  }

  async function createSupervisorSession(fixture: Awaited<ReturnType<typeof createSchedulingFixture>>) {
    const supervisorEmail = `supervisor-${randomBytes(3).toString("hex")}@example.com`;
    const supervisorPassword = `Super!${randomBytes(4).toString("hex")}`;
    const supervisor = await prisma.user.create({
      data: {
        email: supervisorEmail,
        passwordHash: await argon2.hash(supervisorPassword, ARGON2_OPTIONS),
        fullName: "Site Supervisor"
      }
    });

    await prisma.companyMembership.create({
      data: {
        companyId: fixture.companyId,
        userId: supervisor.id,
        email: supervisorEmail,
        role: "SUPERVISOR",
        status: "ACTIVE"
      }
    });

    await prisma.supervisorLocationAssignment.create({
      data: {
        groupId: (await prisma.company.findUniqueOrThrow({ where: { id: fixture.companyId } })).groupId,
        companyId: fixture.companyId,
        locationId: fixture.locationId,
        supervisorUserId: supervisor.id,
        assignedByUserId: supervisor.id
      }
    });

    return login(supervisorEmail, supervisorPassword);
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
