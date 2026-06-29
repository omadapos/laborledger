import { randomBytes } from "node:crypto";

import { GlobalRole, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

export const INTEGRATION_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

const PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
const PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
const PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

/**
 * Canonical truncate list for integration specs — children before parents.
 * CASCADE handles FKs from unlisted tables that reference these rows.
 */
const INTEGRATION_TRUNCATE_SQL = `
  TRUNCATE TABLE
    client_invoice_deliveries,
    client_invoice_lines,
    client_invoices,
    service_completions,
    worker_scan_events,
    vehicle_responsibility_logs,
    work_order_assignments,
    work_order_status_history,
    work_order_service_lines,
    work_orders,
    vehicles,
    service_catalog_items,
    weekly_close_snapshots,
    weekly_periods,
    punch_corrections,
    correction_requests,
    punch_events,
    kiosk_credentials,
    kiosks,
    shifts,
    shift_generation_batches,
    schedule_templates,
    supervisor_location_assignments,
    client_labor_rates,
    employee_rates,
    employee_pin_credentials,
    employees,
    locations,
    service_clients,
    audit_events,
    password_reset_tokens,
    invitations,
    company_memberships,
    group_memberships,
    sessions,
    companies,
    groups,
    users
  RESTART IDENTITY CASCADE;
`;

type IntegrationEnvOverrides = Record<string, string | undefined>;

export function configureIntegrationTestEnv(overrides: IntegrationEnvOverrides = {}) {
  process.env.DATABASE_URL = INTEGRATION_DATABASE_URL;
  process.env.PLATFORM_SUPERADMIN_EMAIL = PLATFORM_SUPERADMIN_EMAIL;
  process.env.PLATFORM_SUPERADMIN_PASSWORD = PLATFORM_SUPERADMIN_PASSWORD;
  process.env.PLATFORM_SUPERADMIN_NAME = PLATFORM_SUPERADMIN_NAME;

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

export function createIntegrationPrisma() {
  return new PrismaClient({ datasourceUrl: INTEGRATION_DATABASE_URL });
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomBytes(4).toString("hex")}@example.test`;
}

export function uniqueLabel(prefix: string) {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

async function withDeadlockRetry<T>(operation: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : "";

      if (code === "40P01" && attempt < attempts - 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, 75 * (attempt + 1));
        });
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

export async function seedPlatformSuperadmin(prisma: PrismaClient) {
  const passwordHash = await argon2.hash(PLATFORM_SUPERADMIN_PASSWORD, ARGON2_OPTIONS);

  await prisma.user.upsert({
    where: { email: PLATFORM_SUPERADMIN_EMAIL },
    create: {
      email: PLATFORM_SUPERADMIN_EMAIL,
      passwordHash,
      fullName: PLATFORM_SUPERADMIN_NAME,
      globalRole: GlobalRole.PLATFORM_SUPERADMIN
    },
    update: {
      passwordHash,
      fullName: PLATFORM_SUPERADMIN_NAME,
      globalRole: GlobalRole.PLATFORM_SUPERADMIN
    }
  });
}

export async function resetIntegrationDatabase(prisma: PrismaClient) {
  await withDeadlockRetry(async () => {
    await prisma.$executeRawUnsafe(INTEGRATION_TRUNCATE_SQL);
  });
  await seedPlatformSuperadmin(prisma);
}
