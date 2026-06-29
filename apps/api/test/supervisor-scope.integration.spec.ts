import "reflect-metadata";

import { randomBytes, randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { CompanyRole, MembershipStatus, PrismaClient } from "@prisma/client";
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

describe("supervisor location scope", () => {
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

  it("lets company admins access full company data while supervisors see only assigned locations", async () => {
    const fixture = await createScopedFixture();
    const adminSession = await login(fixture.adminEmail, fixture.adminPassword);
    const supervisorSession = await login(fixture.supervisorEmail, fixture.supervisorPassword);

    const adminLocations = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/locations`)
      .set("Cookie", adminSession)
      .expect(200);
    expect(adminLocations.body).toHaveLength(2);

    const supervisorLocations = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/locations`)
      .set("Cookie", supervisorSession)
      .expect(200);
    expect(supervisorLocations.body).toHaveLength(1);
    expect(supervisorLocations.body[0].id).toBe(fixture.locationAId);

    await request(httpServer)
      .get(`/company-operations/locations/${fixture.locationBId}`)
      .set("Cookie", supervisorSession)
      .expect(403);

    const adminReview = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/review-shifts`)
      .set("Cookie", adminSession)
      .expect(200);
    expect(adminReview.body).toHaveLength(2);

    const supervisorReview = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/review-shifts`)
      .set("Cookie", supervisorSession)
      .expect(200);
    expect(supervisorReview.body).toHaveLength(1);
    expect(supervisorReview.body[0].location.id).toBe(fixture.locationAId);
  });

  it("blocks supervisor review and correction actions outside assigned locations", async () => {
    const fixture = await createScopedFixture();
    const supervisorSession = await login(fixture.supervisorEmail, fixture.supervisorPassword);

    await request(httpServer)
      .get(`/company-operations/shifts/${fixture.shiftBId}/review`)
      .set("Cookie", supervisorSession)
      .expect(403);

    await request(httpServer)
      .post(`/company-operations/shifts/${fixture.shiftAId}/approve`)
      .set("Cookie", supervisorSession)
      .send({})
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/shifts/${fixture.shiftBId}/approve`)
      .set("Cookie", supervisorSession)
      .send({})
      .expect(403);

    const adminSession = await login(fixture.adminEmail, fixture.adminPassword);
    const correction = await request(httpServer)
      .post(`/company-operations/shifts/${fixture.shiftBId}/corrections`)
      .set("Cookie", adminSession)
      .send({
        type: "MISSING_CLOCK_OUT",
        reason: "Forgot to clock out",
        proposedEventUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(201);

    await request(httpServer)
      .get(`/company-operations/corrections/${correction.body.id}`)
      .set("Cookie", supervisorSession)
      .expect(403);

    await request(httpServer)
      .post(`/company-operations/corrections/${correction.body.id}/approve`)
      .set("Cookie", supervisorSession)
      .send({})
      .expect(403);
  });

  it("blocks supervisors from weekly close, kiosk admin, and correction creation", async () => {
    const fixture = await createScopedFixture();
    const supervisorSession = await login(fixture.supervisorEmail, fixture.supervisorPassword);

    await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/weekly-close?weekStart=2026-04-06`)
      .set("Cookie", supervisorSession)
      .expect(403);

    await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/kiosks`)
      .set("Cookie", supervisorSession)
      .expect(403);

    await request(httpServer)
      .post(`/company-operations/shifts/${fixture.shiftAId}/corrections`)
      .set("Cookie", supervisorSession)
      .send({
        type: "MISSING_CLOCK_OUT",
        reason: "Supervisor attempt",
        proposedEventUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(403);
  });

  it("returns empty scoped lists for supervisors with no assigned locations", async () => {
    const fixture = await createScopedFixture({ assignSupervisor: false });
    const supervisorSession = await login(fixture.supervisorEmail, fixture.supervisorPassword);

    const locations = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/locations`)
      .set("Cookie", supervisorSession)
      .expect(200);
    expect(locations.body).toHaveLength(0);

    const review = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/review-shifts`)
      .set("Cookie", supervisorSession)
      .expect(200);
    expect(review.body).toHaveLength(0);

    const accessContext = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/access-context`)
      .set("Cookie", supervisorSession)
      .expect(200);
    expect(accessContext.body.accessLevel).toBe("supervisor");
    expect(accessContext.body.allowedLocationIds).toEqual([]);
  });

  it("lists supervisor companies and rejects cross-company access", async () => {
    const fixtureA = await createScopedFixture({ label: "Alpha" });
    const fixtureB = await createScopedFixture({ label: "Beta" });
    const supervisorASession = await login(fixtureA.supervisorEmail, fixtureA.supervisorPassword);

    const companies = await request(httpServer)
      .get("/companies")
      .set("Cookie", supervisorASession)
      .expect(200);
    expect(companies.body.some((company: { id: string }) => company.id === fixtureA.companyId)).toBe(true);
    expect(companies.body.some((company: { id: string }) => company.id === fixtureB.companyId)).toBe(false);

    await request(httpServer)
      .get(`/company-operations/companies/${fixtureB.companyId}/review-shifts`)
      .set("Cookie", supervisorASession)
      .expect(403);
  });

  async function createScopedFixture(options?: { label?: string; assignSupervisor?: boolean }) {
    const label = options?.label ?? "Alpha";
    const assignSupervisor = options?.assignSupervisor ?? true;
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
      .send({
        token: groupResponse.body.invitationToken,
        password: ownerPassword,
        fullName: `${label} Owner`
      })
      .expect(200);

    const ownerSession = await login(ownerEmail, ownerPassword);

    const adminEmail = `${label.toLowerCase()}-admin-${randomBytes(3).toString("hex")}@example.com`;
    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;
    const supervisorEmail = `${label.toLowerCase()}-supervisor-${randomBytes(3).toString("hex")}@example.com`;
    const supervisorPassword = `Super!${randomBytes(4).toString("hex")}`;

    const companyResponse = await request(httpServer)
      .post(`/groups/${groupResponse.body.group.id as string}/companies`)
      .set("Cookie", ownerSession)
      .send({ name: `${label} Company`, adminEmail })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: companyResponse.body.invitationToken,
        password: adminPassword,
        fullName: `${label} Admin`
      })
      .expect(200);

    const companyId = companyResponse.body.company.id as string;
    const adminSession = await login(adminEmail, adminPassword);

    const supervisorUser = await prisma.user.create({
      data: {
        email: supervisorEmail,
        passwordHash: await argon2.hash(supervisorPassword, ARGON2_OPTIONS),
        fullName: `${label} Supervisor`
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

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: `${label} Client` })
      .expect(201);

    const locationAResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        name: `${label} Site A`,
        timezone: "America/New_York",
        serviceClientId: clientResponse.body.id
      })
      .expect(201);

    const locationBResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        name: `${label} Site B`,
        timezone: "America/New_York",
        serviceClientId: clientResponse.body.id
      })
      .expect(201);

    if (assignSupervisor) {
      await request(httpServer)
        .post(`/company-operations/locations/${locationAResponse.body.id}/supervisors`)
        .set("Cookie", adminSession)
        .send({ supervisorUserId: supervisorUser.id })
        .expect(201);
    }

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Carlos Rivera", pin: "654321" })
      .expect(201);

    const employeeA = await prisma.employee.findFirstOrThrow({
      where: { companyId, fullName: "Maria Gomez" }
    });
    const employeeB = await prisma.employee.findFirstOrThrow({
      where: { companyId, fullName: "Carlos Rivera" }
    });

    const shiftAResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/shifts`)
      .set("Cookie", adminSession)
      .send({
        employeeId: employeeA.id,
        serviceClientId: clientResponse.body.id,
        locationId: locationAResponse.body.id,
        scheduledStartUtc: "2026-04-06T13:00:00.000Z",
        scheduledEndUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(201);

    const shiftBResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/shifts`)
      .set("Cookie", adminSession)
      .send({
        employeeId: employeeB.id,
        serviceClientId: clientResponse.body.id,
        locationId: locationBResponse.body.id,
        scheduledStartUtc: "2026-04-06T13:00:00.000Z",
        scheduledEndUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(201);

    const kioskSecretA = `kiosk-a-${randomBytes(8).toString("hex")}`;
    const kioskA = await prisma.kiosk.create({
      data: {
        groupId: employeeA.groupId,
        companyId,
        locationId: locationAResponse.body.id,
        name: `${label} Kiosk A`
      }
    });
    await prisma.kioskCredential.create({
      data: {
        kioskId: kioskA.id,
        secretHash: await argon2.hash(kioskSecretA, ARGON2_OPTIONS)
      }
    });

    const kioskSecretB = `kiosk-b-${randomBytes(8).toString("hex")}`;
    const kioskB = await prisma.kiosk.create({
      data: {
        groupId: employeeA.groupId,
        companyId,
        locationId: locationBResponse.body.id,
        name: `${label} Kiosk B`
      }
    });
    await prisma.kioskCredential.create({
      data: {
        kioskId: kioskB.id,
        secretHash: await argon2.hash(kioskSecretB, ARGON2_OPTIONS)
      }
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T21:00:00.000Z"));

    await request(httpServer)
      .post("/kiosk/punch")
      .set({
        "x-kiosk-id": kioskA.id,
        "x-kiosk-secret": kioskSecretA
      })
      .send({ pin: "123456", action: "clock_in", idempotencyKey: randomUUID() })
      .expect(201);
    await request(httpServer)
      .post("/kiosk/punch")
      .set({
        "x-kiosk-id": kioskA.id,
        "x-kiosk-secret": kioskSecretA
      })
      .send({ pin: "123456", action: "clock_out", idempotencyKey: randomUUID() })
      .expect(201);

    await request(httpServer)
      .post("/kiosk/punch")
      .set({
        "x-kiosk-id": kioskB.id,
        "x-kiosk-secret": kioskSecretB
      })
      .send({ pin: "654321", action: "clock_in", idempotencyKey: randomUUID() })
      .expect(201);

    vi.useRealTimers();

    return {
      companyId,
      locationAId: locationAResponse.body.id as string,
      locationBId: locationBResponse.body.id as string,
      shiftAId: shiftAResponse.body.id as string,
      shiftBId: shiftBResponse.body.id as string,
      adminEmail,
      adminPassword,
      supervisorEmail,
      supervisorPassword
    };
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const cookies = response.headers["set-cookie"] as string[] | undefined;
    expect(cookies && cookies.length > 0).toBe(true);
    return cookies?.[0] ?? "";
  }
});
