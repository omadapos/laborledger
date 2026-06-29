import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { CompanyRole, GroupRole, GroupStatus, MembershipStatus, PrismaClient } from "@prisma/client";
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

describe("PLATFORM02 SaaS customer lifecycle", () => {
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

  it("lets platform superadmin suspend, reactivate, and archive customers with audit trails", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const fixture = await createPlatformCustomer(superadminSession);
    const ownerSessionBeforeSuspend = await login(fixture.ownerEmail, fixture.ownerPassword);
    await request(httpServer).get("/auth/me").set("Cookie", ownerSessionBeforeSuspend).expect(200);

    await request(httpServer)
      .post(`/platform/customers/${fixture.groupId}/suspend`)
      .set("Cookie", superadminSession)
      .send({})
      .expect(400);

    await request(httpServer)
      .post(`/platform/customers/${fixture.groupId}/suspend`)
      .set("Cookie", superadminSession)
      .send({ reason: "Non-payment review" })
      .expect(200);

    const suspendedList = await request(httpServer)
      .get("/platform/customers")
      .set("Cookie", superadminSession)
      .expect(200);

    expect(suspendedList.body[0].lifecycleStatus).toBe("SUSPENDED");
    expect(suspendedList.body[0].suspendedReason).toBe("Non-payment review");

    await request(httpServer)
      .get("/auth/me")
      .set("Cookie", ownerSessionBeforeSuspend)
      .expect(401);

    const ownerSessionWhileSuspended = await login(fixture.ownerEmail, fixture.ownerPassword);
    const blockedMe = await request(httpServer)
      .get("/auth/me")
      .set("Cookie", ownerSessionWhileSuspended)
      .expect(200);
    expect(blockedMe.body.accessibleCompanies).toHaveLength(0);

    await request(httpServer)
      .post(`/platform/customers/${fixture.groupId}/reactivate`)
      .set("Cookie", superadminSession)
      .expect(200);

    const ownerSession = await login(fixture.ownerEmail, fixture.ownerPassword);
    const meAfterReactivate = await request(httpServer)
      .get("/auth/me")
      .set("Cookie", ownerSession)
      .expect(200);
    expect(meAfterReactivate.body.accessibleCompanies).toHaveLength(1);

    await request(httpServer)
      .post(`/platform/customers/${fixture.groupId}/archive`)
      .set("Cookie", superadminSession)
      .send({ reason: "Customer churned" })
      .expect(200);

    await request(httpServer)
      .post(`/platform/customers/${fixture.groupId}/reactivate`)
      .set("Cookie", superadminSession)
      .expect(400);

    const companyCount = await prisma.company.count({ where: { groupId: fixture.groupId } });
    expect(companyCount).toBe(1);

    const auditActions = await prisma.auditEvent.findMany({
      where: {
        groupId: fixture.groupId,
        action: {
          in: [
            "PLATFORM_CUSTOMER_SUSPENDED",
            "PLATFORM_CUSTOMER_REACTIVATED",
            "PLATFORM_CUSTOMER_ARCHIVED"
          ]
        }
      }
    });

    expect(auditActions.some((event) => event.action === "PLATFORM_CUSTOMER_SUSPENDED")).toBe(true);
    expect(auditActions.some((event) => event.action === "PLATFORM_CUSTOMER_REACTIVATED")).toBe(true);
    expect(auditActions.some((event) => event.action === "PLATFORM_CUSTOMER_ARCHIVED")).toBe(true);

    const archivedGroup = await prisma.group.findUniqueOrThrow({
      where: { id: fixture.groupId }
    });
    expect(archivedGroup.status).toBe(GroupStatus.ARCHIVED);
  });

  it("blocks tenant company access for suspended groups while keeping active companies accessible", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const activeCustomer = await createPlatformCustomer(superadminSession, "Active Co");
    const suspendedCustomer = await createPlatformCustomer(superadminSession, "Suspended Co");

    await request(httpServer)
      .post(`/platform/customers/${suspendedCustomer.groupId}/suspend`)
      .set("Cookie", superadminSession)
      .send({ reason: "Policy review" })
      .expect(200);

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: activeCustomer.ownerEmail }
    });

    await prisma.groupMembership.create({
      data: {
        groupId: suspendedCustomer.groupId,
        userId: owner.id,
        email: owner.email,
        role: GroupRole.GROUP_OWNER,
        status: MembershipStatus.ACTIVE
      }
    });

    await prisma.companyMembership.create({
      data: {
        companyId: suspendedCustomer.companyId,
        userId: owner.id,
        email: owner.email,
        role: CompanyRole.COMPANY_ADMIN,
        status: MembershipStatus.ACTIVE
      }
    });

    const ownerSession = await login(activeCustomer.ownerEmail, activeCustomer.ownerPassword);
    const me = await request(httpServer).get("/auth/me").set("Cookie", ownerSession).expect(200);

    expect(me.body.accessibleCompanies).toHaveLength(1);
    expect(me.body.accessibleCompanies[0].id).toBe(activeCustomer.companyId);

    await request(httpServer)
      .post("/auth/select-company")
      .set("Cookie", ownerSession)
      .send({ companyId: suspendedCustomer.companyId })
      .expect(403);

    await request(httpServer)
      .get(`/company-operations/companies/${activeCustomer.companyId}/employees`)
      .set("Cookie", ownerSession)
      .expect(200);
  });

  it("rejects lifecycle actions from non-superadmin users", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const fixture = await createPlatformCustomer(superadminSession);
    const ownerSession = await login(fixture.ownerEmail, fixture.ownerPassword);

    await request(httpServer)
      .post(`/platform/customers/${fixture.groupId}/suspend`)
      .set("Cookie", ownerSession)
      .send({ reason: "Should fail" })
      .expect(403);
  });

  it("blocks worker lookup for suspended customer companies", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const fixture = await createPlatformCustomer(superadminSession);

    await request(httpServer)
      .post(`/platform/customers/${fixture.groupId}/suspend`)
      .set("Cookie", superadminSession)
      .send({ reason: "Suspended for worker test" })
      .expect(200);

    const lookup = await request(httpServer)
      .post("/worker/lookup")
      .send({ companyId: fixture.companyId, pin: "123456" });

    expect(lookup.status).toBe(403);
    expect(JSON.stringify(lookup.body)).toContain("ACCOUNT_SUSPENDED");
  });

  async function createPlatformCustomer(superadminSession: string, label = "Acme Fleet") {
    const ownerEmail = `${label.toLowerCase().replace(/\s+/gu, "-")}-${randomBytes(3).toString("hex")}@example.com`;
    const ownerPassword = "OwnerTemp!123";

    const created = await request(httpServer)
      .post("/platform/customers")
      .set("Cookie", superadminSession)
      .send({
        customerName: label,
        companyName: `${label} Main Shop`,
        ownerFullName: `${label} Owner`,
        ownerEmail,
        ownerPassword
      })
      .expect(201);

    return {
      groupId: created.body.customer.id as string,
      companyId: created.body.company.id as string,
      ownerEmail,
      ownerPassword
    };
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const raw = (response.headers["set-cookie"] as string[] | undefined)?.find((value) =>
      value.startsWith("laborledger.sid=")
    );
    return raw?.split(";")[0] ?? "";
  }
});
