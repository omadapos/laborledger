import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";
import { NhtsaVpicVinDecoderService } from "../src/modules/vin-decode/nhtsa-vpic-vin-decoder.service";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
const KNOWN_VIN = "1HGBH41JXMN109186";
const NHTSA_VIN = "1HGCM82633A004352";

describe("VIN02 NHTSA decode foundation", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;
  let originalDecoder: string | undefined;
  let originalFetch: typeof fetch;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();
    originalFetch = globalThis.fetch;
  });

  beforeEach(async () => {
    originalDecoder = process.env.VIN_DECODER;
    process.env.VIN_DECODER = "stub";

    await resetIntegrationDatabase(prisma);

    });

  afterEach(() => {
    process.env.VIN_DECODER = originalDecoder;
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("supports stub preview decode, NHTSA mocked decode/create, and validation without live network", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);

    const client = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: "Client A" })
      .expect(201);

    const location = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: client.body.id,
        name: "Location A",
        timezone: "America/New_York"
      })
      .expect(201);

    await request(httpServer)
      .post("/company-operations/vehicles/decode-vin")
      .set("Cookie", adminSession)
      .send({ vin: "INVALID" })
      .expect(400);

    const vehicleCountBefore = await prisma.vehicle.count();

    const preview = await request(httpServer)
      .post("/company-operations/vehicles/decode-vin")
      .set("Cookie", adminSession)
      .send({ vin: KNOWN_VIN })
      .expect(201);

    expect(preview.body.decodeSource).toBe("STUB");
    expect(preview.body.make).toBe("Honda");
    expect(JSON.stringify(preview.body).toLowerCase()).not.toContain("passwordhash");

    const vehicleCountAfterPreview = await prisma.vehicle.count();
    expect(vehicleCountAfterPreview).toBe(vehicleCountBefore);

    process.env.VIN_DECODER = "nhtsa";

    const mockFetch = vi.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            Results: [
              {
                "Model Year": "2003",
                Make: "HONDA",
                Model: "Accord",
                Trim: "EX",
                "Body Class": "Coupe",
                "Vehicle Type": "PASSENGER CAR",
                "Fuel Type - Primary": "Gasoline",
                "Engine Number of Cylinders": "4",
                "Displacement (L)": "2.4",
                "Manufacturer Name": "AMERICAN HONDA MOTOR CO., INC.",
                "Plant Country": "UNITED STATES (USA)",
                "Error Code": "0",
                "Error Text": "0 - VIN decoded clean."
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    globalThis.fetch = mockFetch as typeof fetch;

    const nhtsaPreview = await request(httpServer)
      .post("/company-operations/vehicles/decode-vin")
      .set("Cookie", adminSession)
      .send({ vin: NHTSA_VIN, modelYear: 2003 })
      .expect(201);

    expect(nhtsaPreview.body.decodeSource).toBe("NHTSA_VPIC");
    expect(nhtsaPreview.body.make).toBe("HONDA");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const created = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/vehicles`)
      .set("Cookie", adminSession)
      .send({
        vin: NHTSA_VIN,
        serviceClientId: client.body.id,
        locationId: location.body.id
      })
      .expect(201);

    expect(created.body.decodeSource).toBe("NHTSA_VPIC");
    expect(created.body.make).toBe("HONDA");
    expect(created.body.model).toBe("Accord");
    expect(created.body.decodePayload).toMatchObject({
      Results: expect.any(Array)
    });

    mockFetch.mockImplementationOnce(async () => Promise.reject(new Error("timeout")));

    await request(httpServer)
      .post("/company-operations/vehicles/decode-vin")
      .set("Cookie", adminSession)
      .send({ vin: NHTSA_VIN })
      .expect(503);

    const failingFetch = vi.fn(async () => Promise.reject(new Error("timeout")));
    const decoder = new NhtsaVpicVinDecoderService(failingFetch as typeof fetch);
    await expect(decoder.decode(NHTSA_VIN)).rejects.toThrow(/timed out or failed/i);
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
