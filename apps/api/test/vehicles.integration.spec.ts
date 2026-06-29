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
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

const KNOWN_VIN = "1HGBH41JXMN109186";
const KNOWN_VIN_LOWER = "1hgbh41jxmn109186";

describe("vehicle intake foundation", () => {
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

  it("supports company-scoped vehicle intake with VIN validation and stub decode", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const clientAResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/service-clients`)
      .set("Cookie", adminASession)
      .send({ name: "Client A" })
      .expect(201);
    const clientAId = clientAResponse.body.id as string;

    const locationAResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/locations`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: clientAId,
        name: "Location A",
        timezone: "America/New_York"
      })
      .expect(201);
    const locationAId = locationAResponse.body.id as string;

    const clientBResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/service-clients`)
      .set("Cookie", superadminSession)
      .send({ name: "Client B" })
      .expect(201);
    const clientBId = clientBResponse.body.id as string;

    const locationBResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/locations`)
      .set("Cookie", superadminSession)
      .send({
        serviceClientId: clientBId,
        name: "Location B",
        timezone: "America/New_York"
      })
      .expect(201);
    const locationBId = locationBResponse.body.id as string;

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: clientAId,
        locationId: locationAId
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        vin: "",
        serviceClientId: clientAId,
        locationId: locationAId
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        vin: "   ",
        serviceClientId: clientAId,
        locationId: locationAId
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        vin: "INVALIDVIN123",
        serviceClientId: clientAId,
        locationId: locationAId
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientBId,
        locationId: locationAId
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientAId,
        locationId: locationBId
      })
      .expect(400);

    const createResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        vin: ` ${KNOWN_VIN_LOWER} `,
        serviceClientId: clientAId,
        locationId: locationAId,
        plate: "ABC123",
        color: "Red",
        mileage: 45000,
        notes: "Intake note"
      })
      .expect(201);

    const vehicleId = createResponse.body.id as string;
    expect(createResponse.body.vin).toBe(KNOWN_VIN);
    expect(createResponse.body.make).toBe("Honda");
    expect(createResponse.body.model).toBe("Civic");
    expect(createResponse.body.year).toBe(2021);
    expect(createResponse.body.decodeSource).toBe("STUB");
    expect(createResponse.body.decodePayload).toMatchObject({ provider: "stub-known" });

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientAId,
        locationId: locationAId
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/vehicles`)
      .set("Cookie", superadminSession)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientBId,
        locationId: locationBId
      })
      .expect(201);

    const activeList = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(activeList.body).toHaveLength(1);
    expect(activeList.body[0].vin).toBe(KNOWN_VIN);

    const searchList = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/vehicles?q=honda`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(searchList.body).toHaveLength(1);

    const detail = await request(httpServer)
      .get(`/company-operations/vehicles/${vehicleId}`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(detail.body.plate).toBe("ABC123");

    await request(httpServer)
      .post(`/company-operations/vehicles/${vehicleId}`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: clientAId,
        locationId: locationAId,
        plate: "XYZ999",
        color: "Black",
        mileage: 46000,
        notes: "Updated note"
      })
      .expect(201);

    const updated = await request(httpServer)
      .get(`/company-operations/vehicles/${vehicleId}`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(updated.body.plate).toBe("XYZ999");
    expect(updated.body.mileage).toBe(46000);

    const archived = await request(httpServer)
      .post(`/company-operations/vehicles/${vehicleId}/archive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);
    expect(archived.body.archivedAt).toBeTruthy();

    const activeAfterArchive = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(activeAfterArchive.body).toHaveLength(0);

    const includeArchived = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/vehicles?includeArchived=true`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(includeArchived.body).toHaveLength(1);

    const reactivated = await request(httpServer)
      .post(`/company-operations/vehicles/${vehicleId}/unarchive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);
    expect(reactivated.body.archivedAt).toBeNull();

    await request(httpServer)
      .get(`/company-operations/vehicles/${vehicleId}`)
      .set("Cookie", await login(setupB.adminEmail, setupB.adminPassword))
      .expect(403);

    await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        vin: "5YJSA1E26MF123456",
        serviceClientId: clientBId,
        locationId: locationBId
      })
      .expect(403);

    const auditActions = await prisma.auditEvent.findMany({
      where: { companyId: setupA.companyId, targetType: "Vehicle" },
      select: { action: true }
    });
    expect(auditActions.map((row) => row.action)).toEqual(
      expect.arrayContaining(["VEHICLE_CREATED", "VEHICLE_UPDATED", "VEHICLE_ARCHIVED", "VEHICLE_UNARCHIVED"])
    );
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
