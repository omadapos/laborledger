import { randomBytes } from "node:crypto";

import { PrismaClient, ShiftBatchType, ShiftStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

describe("schedule database foundation", () => {
  it("stores schedule entities with UTC and timezone context", async () => {
    const suffix = randomBytes(4).toString("hex");
    const seeded = await seedSchedulingContext(suffix);

    const batch = await prisma.shiftGenerationBatch.create({
      data: {
        groupId: seeded.group.id,
        companyId: seeded.company.id,
        operationType: ShiftBatchType.RECURRING_TEMPLATE,
        operationKey: `batch-${suffix}`,
        sourceTemplateId: seeded.template.id,
        createdByUserId: seeded.user.id
      }
    });

    const shift = await prisma.shift.create({
      data: {
        groupId: seeded.group.id,
        companyId: seeded.company.id,
        locationId: seeded.location.id,
        employeeId: seeded.employee.id,
        serviceClientId: seeded.client.id,
        status: ShiftStatus.SCHEDULED,
        scheduledStartUtc: new Date("2026-04-06T03:00:00.000Z"),
        scheduledEndUtc: new Date("2026-04-06T11:00:00.000Z"),
        timezone: seeded.location.timezone,
        generationBatchId: batch.id,
        planningKey: `plan-${suffix}`
      }
    });

    expect(shift.status).toBe(ShiftStatus.SCHEDULED);
    expect(shift.timezone).toBe("America/New_York");
    expect(shift.scheduledStartUtc.toISOString()).toBe("2026-04-06T03:00:00.000Z");
    expect(shift.scheduledEndUtc.toISOString()).toBe("2026-04-06T11:00:00.000Z");

    const linked = await prisma.shiftGenerationBatch.findUniqueOrThrow({
      where: { id: batch.id },
      include: {
        shifts: {
          where: {
            id: shift.id
          }
        }
      }
    });

    expect(linked.shifts).toHaveLength(1);
  });

  it("enforces overlap prevention and idempotency foundations", async () => {
    const suffix = randomBytes(4).toString("hex");
    const seeded = await seedSchedulingContext(suffix);

    await prisma.shift.create({
      data: {
        groupId: seeded.group.id,
        companyId: seeded.company.id,
        locationId: seeded.location.id,
        employeeId: seeded.employee.id,
        serviceClientId: seeded.client.id,
        status: ShiftStatus.SCHEDULED,
        scheduledStartUtc: new Date("2026-04-07T12:00:00.000Z"),
        scheduledEndUtc: new Date("2026-04-07T20:00:00.000Z"),
        timezone: seeded.location.timezone,
        planningKey: `overlap-base-${suffix}`
      }
    });

    await expect(
      prisma.shift.create({
        data: {
          groupId: seeded.group.id,
          companyId: seeded.company.id,
          locationId: seeded.location.id,
          employeeId: seeded.employee.id,
          serviceClientId: seeded.client.id,
          status: ShiftStatus.SCHEDULED,
          scheduledStartUtc: new Date("2026-04-07T15:00:00.000Z"),
          scheduledEndUtc: new Date("2026-04-07T22:00:00.000Z"),
          timezone: seeded.location.timezone,
          planningKey: `overlap-conflict-${suffix}`
        }
      })
    ).rejects.toThrow();

    await prisma.shift.create({
      data: {
        groupId: seeded.group.id,
        companyId: seeded.company.id,
        locationId: seeded.location.id,
        employeeId: seeded.employee.id,
        serviceClientId: seeded.client.id,
        status: ShiftStatus.CANCELLED,
        scheduledStartUtc: new Date("2026-04-07T15:00:00.000Z"),
        scheduledEndUtc: new Date("2026-04-07T22:00:00.000Z"),
        timezone: seeded.location.timezone,
        cancelledAt: new Date("2026-04-06T00:00:00.000Z"),
        cancelledByUserId: seeded.user.id,
        cancelReason: "Cancelled before publication",
        planningKey: `overlap-cancelled-${suffix}`
      }
    });

    await prisma.shiftGenerationBatch.create({
      data: {
        groupId: seeded.group.id,
        companyId: seeded.company.id,
        operationType: ShiftBatchType.COPY_WEEK,
        operationKey: `copy-week-${suffix}`,
        createdByUserId: seeded.user.id
      }
    });

    await expect(
      prisma.shiftGenerationBatch.create({
        data: {
          groupId: seeded.group.id,
          companyId: seeded.company.id,
          operationType: ShiftBatchType.COPY_WEEK,
          operationKey: `copy-week-${suffix}`,
          createdByUserId: seeded.user.id
        }
      })
    ).rejects.toThrow();
  });
});

async function seedSchedulingContext(suffix: string) {
  const user = await prisma.user.create({
    data: {
      email: `schedule-db-${suffix}@example.com`,
      passwordHash: `hash-${suffix}`
    }
  });

  const group = await prisma.group.create({
    data: {
      name: `Schedule Group ${suffix}`
    }
  });

  const company = await prisma.company.create({
    data: {
      groupId: group.id,
      name: `Schedule Company ${suffix}`
    }
  });

  const client = await prisma.serviceClient.create({
    data: {
      groupId: group.id,
      companyId: company.id,
      name: `Schedule Client ${suffix}`
    }
  });

  const location = await prisma.location.create({
    data: {
      groupId: group.id,
      companyId: company.id,
      serviceClientId: client.id,
      name: `Schedule Location ${suffix}`,
      timezone: "America/New_York"
    }
  });

  const employee = await prisma.employee.create({
    data: {
      groupId: group.id,
      companyId: company.id,
      fullName: `Schedule Employee ${suffix}`
    }
  });

  const template = await prisma.scheduleTemplate.create({
    data: {
      groupId: group.id,
      companyId: company.id,
      locationId: location.id,
      employeeId: employee.id,
      serviceClientId: client.id,
      name: `Template ${suffix}`,
      daysOfWeek: [1, 3, 5],
      localStartTime: "22:00",
      localEndTime: "06:00",
      timezone: location.timezone,
      startsOnDate: new Date("2026-01-01T00:00:00.000Z"),
      createdByUserId: user.id
    }
  });

  return { user, group, company, client, location, employee, template };
}
