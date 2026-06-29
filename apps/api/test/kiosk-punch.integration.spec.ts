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

describe("kiosk punch state machine", () => {
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

  it("runs the full punch sequence and rejects invalid transitions", async () => {
    const fixture = await createPunchFixture();
    const headers = kioskHeaders(fixture.kiosk.id, fixture.kioskSecret);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:50:00.000Z"));

    const clockIn = await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(201);

    expect(clockIn.body.accepted).toBe(true);
    expect(clockIn.body.punchState).toBe("clocked_in");
    expect(clockIn.body.warnings).toContain("Early clock-in minutes are included and flagged for review.");

    vi.setSystemTime(new Date("2026-04-06T17:00:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "break_start",
        idempotencyKey: randomUUID()
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.punchState).toBe("on_break");
      });

    vi.setSystemTime(new Date("2026-04-06T17:20:00.000Z"));

    const breakEnd = await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "break_end",
        idempotencyKey: randomUUID()
      })
      .expect(201);

    expect(breakEnd.body.punchState).toBe("clocked_in");
    expect(breakEnd.body.warnings.some((warning: string) => warning.includes("Break duration"))).toBe(
      true
    );

    vi.setSystemTime(new Date("2026-04-06T21:00:00.000Z"));

    const clockOut = await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "clock_out",
        idempotencyKey: randomUUID()
      })
      .expect(201);

    expect(clockOut.body.punchState).toBe("clocked_out");
    expect(clockOut.body.workedMinutes).toBe(470);

    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain("current punch state");
      });
  });

  it("rejects clock-in before the allowed window and after scheduled end", async () => {
    const fixture = await createPunchFixture();
    const headers = kioskHeaders(fixture.kiosk.id, fixture.kioskSecret);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:49:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain("10 minutes");
      });

    vi.setSystemTime(new Date("2026-04-06T21:01:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain("correction");
      });
  });

  it("marks late clock-in and rejects duplicate idempotency keys", async () => {
    const fixture = await createPunchFixture();
    const headers = kioskHeaders(fixture.kiosk.id, fixture.kioskSecret);
    const idempotencyKey = randomUUID();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T13:06:00.000Z"));

    const first = await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey
      })
      .expect(201);

    expect(first.body.warnings).toContain("Clock-in is late.");

    const duplicate = await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey
      })
      .expect(201);

    expect(duplicate.body.duplicate).toBe(true);
    expect(duplicate.body.punchState).toBe("clocked_in");

    const eventCount = await prisma.punchEvent.count({
      where: { idempotencyKey }
    });
    expect(eventCount).toBe(1);
  });

  it("rejects employee PIN from another company and wrong-location shift", async () => {
    const fixtureA = await createPunchFixture();
    const fixtureB = await createPunchFixture("Beta", undefined, {
      includeMaria: false,
      createShift: false
    });

    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixtureA.kiosk.id, fixtureA.kioskSecret))
      .send({
        pin: "654321",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(401);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:50:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixtureB.kiosk.id, fixtureB.kioskSecret))
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(401);
  });

  it("rejects punch when employee shift is at a different location than the kiosk", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Gamma", "gamma-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: "Gamma Client" })
      .expect(201);

    const shiftLocation = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        name: "Gamma Shift Site",
        timezone: "America/New_York",
        serviceClientId: clientResponse.body.id
      })
      .expect(201);

    const kioskLocation = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        name: "Gamma Kiosk Site",
        timezone: "America/New_York",
        serviceClientId: clientResponse.body.id
      })
      .expect(201);

    const employeeResponse = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Gamma Worker", pin: "111111" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/shifts`)
      .set("Cookie", adminSession)
      .send({
        employeeId: employeeResponse.body.id,
        serviceClientId: clientResponse.body.id,
        locationId: shiftLocation.body.id,
        scheduledStartUtc: "2026-04-06T13:00:00.000Z",
        scheduledEndUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(201);

    const kioskSecret = `kiosk-${randomBytes(8).toString("hex")}`;
    const kiosk = await prisma.kiosk.create({
      data: {
        groupId: (
          await prisma.company.findUniqueOrThrow({ where: { id: setup.companyId } })
        ).groupId,
        companyId: setup.companyId,
        locationId: kioskLocation.body.id,
        name: "Gamma Kiosk"
      }
    });

    await prisma.kioskCredential.create({
      data: {
        kioskId: kiosk.id,
        secretHash: await argon2.hash(kioskSecret, ARGON2_OPTIONS)
      }
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:50:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(kiosk.id, kioskSecret))
      .send({
        pin: "111111",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(404);
  });

  it("rejects clock-out while break is open and second break start", async () => {
    const fixture = await createPunchFixture();
    const headers = kioskHeaders(fixture.kiosk.id, fixture.kioskSecret);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T13:00:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(201);

    vi.setSystemTime(new Date("2026-04-06T17:00:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "break_start",
        idempotencyKey: randomUUID()
      })
      .expect(201);

    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "clock_out",
        idempotencyKey: randomUUID()
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain("break is open");
      });

    vi.setSystemTime(new Date("2026-04-06T17:30:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "break_end",
        idempotencyKey: randomUUID()
      })
      .expect(201);

    await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "break_start",
        idempotencyKey: randomUUID()
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain("Only one unpaid break");
      });
  });

  it("uses location timezone context for overnight shift punches", async () => {
    const fixture = await createPunchFixture(undefined, {
      scheduledStartUtc: "2026-04-06T02:00:00.000Z",
      scheduledEndUtc: "2026-04-06T10:00:00.000Z",
      timezone: "America/New_York"
    });
    const headers = kioskHeaders(fixture.kiosk.id, fixture.kioskSecret);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T01:50:00.000Z"));

    const response = await request(httpServer)
      .post("/kiosk/punch")
      .set(headers)
      .send({
        pin: "123456",
        action: "clock_in",
        idempotencyKey: randomUUID()
      })
      .expect(201);

    expect(response.body.timezone).toBe("America/New_York");
    expect(response.body.punchState).toBe("clocked_in");
  });

  async function createPunchFixture(
    label = "Alpha",
    shiftInput?: {
      scheduledStartUtc: string;
      scheduledEndUtc: string;
      timezone?: string;
    },
    options?: {
      includeMaria?: boolean;
      createShift?: boolean;
    }
  ) {
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
        timezone: shiftInput?.timezone ?? "America/New_York",
        serviceClientId: clientResponse.body.id
      })
      .expect(201);

    if (options?.includeMaria !== false) {
      await request(httpServer)
        .post(`/company-operations/companies/${setup.companyId}/employees`)
        .set("Cookie", adminSession)
        .send({ fullName: "Maria Gomez", pin: "123456" })
        .expect(201);
    }

    if (label === "Beta") {
      await request(httpServer)
        .post(`/company-operations/companies/${setup.companyId}/employees`)
        .set("Cookie", adminSession)
        .send({ fullName: "Other Co Employee", pin: "654321" })
        .expect(201);
    }

    const employee = await prisma.employee.findFirst({
      where: { companyId: setup.companyId, fullName: "Maria Gomez" }
    });

    if (employee && options?.createShift !== false) {
      await request(httpServer)
        .post(`/company-operations/companies/${setup.companyId}/shifts`)
        .set("Cookie", adminSession)
        .send({
          employeeId: employee.id,
          serviceClientId: clientResponse.body.id,
          locationId: locationResponse.body.id,
          scheduledStartUtc: shiftInput?.scheduledStartUtc ?? "2026-04-06T13:00:00.000Z",
          scheduledEndUtc: shiftInput?.scheduledEndUtc ?? "2026-04-06T21:00:00.000Z"
        })
        .expect(201);
    }

    const kioskSecret = `kiosk-${randomBytes(8).toString("hex")}`;
    const kiosk = await prisma.kiosk.create({
      data: {
        groupId: employee?.groupId ?? (await prisma.company.findUniqueOrThrow({ where: { id: setup.companyId } })).groupId,
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
      kiosk,
      kioskSecret,
      employeeId: employee?.id ?? null
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
