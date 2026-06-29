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
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

describe("scheduling foundation", () => {
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

  it("creates, lists, and validates manual shifts", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);
    const adminBSession = await login(setupB.adminEmail, setupB.adminPassword);

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/service-clients`)
      .set("Cookie", adminASession)
      .send({ name: "Client A" })
      .expect(201);

    const locationResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/locations`)
      .set("Cookie", adminASession)
      .send({
        name: "Site A",
        timezone: "America/New_York",
        serviceClientId: clientResponse.body.id
      })
      .expect(201);

    const employeeResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/employees`)
      .set("Cookie", adminASession)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    const employeeBResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/employees`)
      .set("Cookie", adminBSession)
      .send({ fullName: "Other Co Employee", pin: "654321" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/shifts`)
      .set("Cookie", adminASession)
      .send({
        employeeId: "",
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id,
        scheduledStartUtc: "2026-04-06T13:00:00.000Z",
        scheduledEndUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(400);

    const overnightShift = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/shifts`)
      .set("Cookie", adminASession)
      .send({
        employeeId: employeeResponse.body.id,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id,
        scheduledStartUtc: "2026-04-06T02:00:00.000Z",
        scheduledEndUtc: "2026-04-06T10:00:00.000Z"
      })
      .expect(201);

    expect(overnightShift.body.timezone).toBe("America/New_York");
    expect(overnightShift.body.status).toBe("SCHEDULED");

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/shifts`)
      .set("Cookie", adminASession)
      .send({
        employeeId: employeeBResponse.body.id,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id,
        scheduledStartUtc: "2026-04-07T13:00:00.000Z",
        scheduledEndUtc: "2026-04-07T21:00:00.000Z"
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/shifts`)
      .set("Cookie", adminASession)
      .send({
        employeeId: employeeResponse.body.id,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id,
        scheduledStartUtc: "2026-04-06T05:00:00.000Z",
        scheduledEndUtc: "2026-04-06T08:00:00.000Z"
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain("already has a shift during that time");
      });

    const listResponse = await request(httpServer)
      .get(
        `/company-operations/companies/${setupA.companyId}/shifts?from=2026-04-01T00:00:00.000Z&to=2026-04-30T00:00:00.000Z`
      )
      .set("Cookie", adminASession)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].employee.fullName).toBe("Maria Gomez");

    const shiftDetail = await request(httpServer)
      .get(`/company-operations/shifts/${overnightShift.body.id}`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(shiftDetail.body.id).toBe(overnightShift.body.id);
  });

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
