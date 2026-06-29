import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  CompanyRole,
  GlobalRole,
  GroupRole,
  MembershipStatus,
  PrismaClient
} from "@prisma/client";
import * as argon2 from "argon2";
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

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

describe("Platform customer companies", () => {
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

  it("lets superadmin list and create additional companies for a customer", async () => {
    const superadminSession = await loginAsSuperadmin();
    const fixture = await createPlatformCustomer(superadminSession, "Acme Fleet");

    const listed = await request(httpServer)
      .get(`/platform/customers/${fixture.groupId}/companies`)
      .set("Cookie", superadminSession)
      .expect(200);

    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].name).toBe(fixture.companyName);
    expect(listed.body[0].groupId).toBe(fixture.groupId);
    expect(listed.body[0].initialAdmin.email).toBe(fixture.ownerEmail);
    expect(listed.body[0].initialAdmin.status).toBe("Active");

    const adminEmail = `second-admin-${randomBytes(3).toString("hex")}@example.com`;

    const created = await request(httpServer)
      .post(`/groups/${fixture.groupId}/companies`)
      .set("Cookie", superadminSession)
      .send({
        name: "Acme Second Shop",
        adminEmail
      })
      .expect(201);

    expect(created.body.company.name).toBe("Acme Second Shop");
    expect(created.body.company.groupId).toBe(fixture.groupId);
    expect(created.body.invitationToken).toBeTruthy();

    const listedAfter = await request(httpServer)
      .get(`/platform/customers/${fixture.groupId}/companies`)
      .set("Cookie", superadminSession)
      .expect(200);

    expect(listedAfter.body).toHaveLength(2);
    expect(listedAfter.body[1].name).toBe("Acme Second Shop");
    expect(listedAfter.body[1].initialAdmin.email).toBe(adminEmail);
    expect(listedAfter.body[1].initialAdmin.status).toBe("Invited");
  });

  it("lets group owner create a company only inside their own customer account", async () => {
    const superadminSession = await loginAsSuperadmin();
    const fixture = await createPlatformCustomer(superadminSession, "OwnerCo");
    const ownerSession = await login(fixture.ownerEmail, fixture.ownerPassword);

    const adminEmail = `ownerco-admin-${randomBytes(3).toString("hex")}@example.com`;

    await request(httpServer)
      .post(`/groups/${fixture.groupId}/companies`)
      .set("Cookie", ownerSession)
      .send({
        name: "OwnerCo Branch",
        adminEmail
      })
      .expect(201);

    const otherGroup = await prisma.group.create({
      data: { name: "Other Customer" }
    });

    await request(httpServer)
      .post(`/groups/${otherGroup.id}/companies`)
      .set("Cookie", ownerSession)
      .send({
        name: "Cross Tenant Co",
        adminEmail: `cross-${randomBytes(3).toString("hex")}@example.com`
      })
      .expect(403);
  });

  it("blocks company admin and supervisor from creating sibling companies", async () => {
    const superadminSession = await loginAsSuperadmin();
    const fixture = await createPlatformCustomer(superadminSession, "RoleCo");
    const companyAdminEmail = `company-admin-${randomBytes(3).toString("hex")}@example.com`;
    const companyAdminPassword = "CompanyAdmin!123";

    const companyResponse = await request(httpServer)
      .post(`/groups/${fixture.groupId}/companies`)
      .set("Cookie", superadminSession)
      .send({
        name: "RoleCo Ops",
        adminEmail: companyAdminEmail
      })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: companyResponse.body.invitationToken,
        password: companyAdminPassword,
        fullName: "RoleCo Admin"
      })
      .expect(200);

    const companyAdminSession = await login(companyAdminEmail, companyAdminPassword);

    await request(httpServer)
      .post(`/groups/${fixture.groupId}/companies`)
      .set("Cookie", companyAdminSession)
      .send({
        name: "Sibling Co",
        adminEmail: `sibling-${randomBytes(3).toString("hex")}@example.com`
      })
      .expect(403);

    const supervisorEmail = `supervisor-${randomBytes(3).toString("hex")}@example.com`;
    const supervisorPassword = "Supervisor!123";

    await createActiveUser({
      email: supervisorEmail,
      password: supervisorPassword,
      fullName: "RoleCo Supervisor",
      companyMemberships: [
        {
          companyId: companyResponse.body.company.id as string,
          role: CompanyRole.SUPERVISOR
        }
      ]
    });

    const supervisorSession = await login(supervisorEmail, supervisorPassword);

    await request(httpServer)
      .post(`/groups/${fixture.groupId}/companies`)
      .set("Cookie", supervisorSession)
      .send({
        name: "Supervisor Co",
        adminEmail: `supervisor-co-${randomBytes(3).toString("hex")}@example.com`
      })
      .expect(403);
  });

  it("rejects duplicate company names within the same customer account", async () => {
    const superadminSession = await loginAsSuperadmin();
    const fixture = await createPlatformCustomer(superadminSession, "DupCo");

    await request(httpServer)
      .post(`/groups/${fixture.groupId}/companies`)
      .set("Cookie", superadminSession)
      .send({
        name: fixture.companyName,
        adminEmail: `dup-${randomBytes(3).toString("hex")}@example.com`
      })
      .expect(409);
  });

  it("invites the initial company admin and exposes the company on choose-company", async () => {
    const superadminSession = await loginAsSuperadmin();
    const fixture = await createPlatformCustomer(superadminSession, "ChooseCo");
    const ownerSession = await login(fixture.ownerEmail, fixture.ownerPassword);
    const adminEmail = `choose-admin-${randomBytes(3).toString("hex")}@example.com`;
    const adminPassword = "ChooseAdmin!123";

    const created = await request(httpServer)
      .post(`/groups/${fixture.groupId}/companies`)
      .set("Cookie", superadminSession)
      .send({
        name: "ChooseCo Satellite",
        adminEmail
      })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: created.body.invitationToken,
        password: adminPassword,
        fullName: "ChooseCo Satellite Admin"
      })
      .expect(200);

    const ownerCompanies = await request(httpServer)
      .get("/companies")
      .set("Cookie", ownerSession)
      .expect(200);

    expect(ownerCompanies.body.map((company: { id: string }) => company.id)).toContain(
      created.body.company.id
    );

    const adminSession = await login(adminEmail, adminPassword);
    const adminCompanies = await request(httpServer)
      .get("/companies")
      .set("Cookie", adminSession)
      .expect(200);

    expect(adminCompanies.body).toHaveLength(1);
    expect(adminCompanies.body[0].id).toBe(created.body.company.id);
  });

  it("blocks company creation for suspended customer accounts", async () => {
    const superadminSession = await loginAsSuperadmin();
    const fixture = await createPlatformCustomer(superadminSession, "SuspendedCo");

    await request(httpServer)
      .post(`/platform/customers/${fixture.groupId}/suspend`)
      .set("Cookie", superadminSession)
      .send({ reason: "Billing hold" })
      .expect(200);

    await request(httpServer)
      .post(`/groups/${fixture.groupId}/companies`)
      .set("Cookie", superadminSession)
      .send({
        name: "Should Not Create",
        adminEmail: `blocked-${randomBytes(3).toString("hex")}@example.com`
      })
      .expect(400);
  });

  it("blocks non-superadmin access to platform company listing", async () => {
    const superadminSession = await loginAsSuperadmin();
    const fixture = await createPlatformCustomer(superadminSession, "PrivateCo");
    const ownerSession = await login(fixture.ownerEmail, fixture.ownerPassword);

    await request(httpServer)
      .get(`/platform/customers/${fixture.groupId}/companies`)
      .set("Cookie", ownerSession)
      .expect(403);
  });

  async function createPlatformCustomer(superadminSession: string, label: string) {
    const ownerEmail = `${label.toLowerCase()}-owner-${randomBytes(3).toString("hex")}@example.com`;
    const ownerPassword = "OwnerTemp!123";
    const companyName = `${label} Main`;

    const created = await request(httpServer)
      .post("/platform/customers")
      .set("Cookie", superadminSession)
      .send({
        customerName: `${label} Customer`,
        companyName,
        ownerFullName: `${label} Owner`,
        ownerEmail,
        ownerPassword
      })
      .expect(201);

    return {
      groupId: created.body.customer.id as string,
      companyId: created.body.company.id as string,
      companyName,
      ownerEmail,
      ownerPassword
    };
  }

  async function createActiveUser(input: {
    email: string;
    password: string;
    fullName: string;
    companyMemberships?: Array<{ companyId: string; role: CompanyRole }>;
  }) {
    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    return prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        globalRole: GlobalRole.NONE,
        companyMemberships: input.companyMemberships
          ? {
              create: input.companyMemberships.map((membership) => ({
                companyId: membership.companyId,
                email: input.email,
                role: membership.role,
                status: MembershipStatus.ACTIVE
              }))
            }
          : undefined
      }
    });
  }

  async function loginAsSuperadmin() {
    return login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
  }

  function extractSessionCookie(setCookie: string[] | undefined) {
    expect(setCookie && setCookie.length > 0).toBe(true);
    const raw = setCookie?.find((value) => value.startsWith("laborledger.sid="));
    expect(raw).toBeTruthy();
    return raw?.split(";")[0] ?? "";
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    return extractSessionCookie(response.headers["set-cookie"] as string[]);
  }
});
