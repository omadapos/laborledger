import {
  CompanyRole,
  GlobalRole,
  GroupRole,
  MembershipStatus,
  PrismaClient,
  type Prisma
} from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as argon2 from "argon2";

import { ensureDemoTimekeepingWeek } from "./seed-demo-timekeeping.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function applyLocalEnvFiles() {
  for (const filename of [".env", ".env.example"]) {
    const envPath = resolve(repoRoot, filename);
    if (!existsSync(envPath)) {
      continue;
    }

    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/u)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }

      if (process.env[parsed.key] === undefined || process.env[parsed.key] === "") {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}

applyLocalEnvFiles();

const DEFAULT_DATABASE_URL =
  "postgresql://laborledger:laborledger@127.0.0.1:55432/laborledger?schema=public";

const DEMO_GROUP_NAME = "Mario Rodriguez Group";
const LEGACY_DEMO_GROUP_NAME = "Demo Group";
const DEMO_COMPANY_NAME = "Family Autobody and Sale Corp";
const LEGACY_DEMO_COMPANY_NAMES = [
  "Marios Autodetail Corp",
  "Demo Company",
  "Marios Detal Mobil",
  "Mario's Detail Mobile",
  "Marios Detail Mobile",
  "Marios Mobile Detail Corp",
  "Demo Company East"
] as const;
const DEMO_LOCATION_TIMEZONE = "America/New_York";

type DemoServiceClientSeed = {
  readonly clientName: string;
  readonly legacyClientNames?: readonly string[];
  readonly locationName?: string;
  readonly legacyLocationNames?: readonly string[];
};

const DEMO_SERVICE_CLIENTS = [
  {
    clientName: "Enterprise Car Sales",
    legacyClientNames: ["Enterprise Rent-A-Car", "Enterprise Demo"],
    locationName: "NH Hudson",
    legacyLocationNames: [
      "MIA Airport Lot",
      "Enterprise Demo Lot",
      "Doral Lot",
      "Brickell Lot",
      "Homestead Lot",
      "Portsmouth, NH"
    ]
  },
  {
    clientName: "Enterprise Rental",
    legacyClientNames: ["Hertz"]
  },
  {
    clientName: "Walk-in Customers",
    legacyClientNames: ["Avis"]
  },
  {
    clientName: "Insurance Customers"
  },
  {
    clientName: "Woburn Customers",
    legacyClientNames: ["Budget Car Rental"]
  }
] as const satisfies readonly DemoServiceClientSeed[];

const DEFAULT_EMPLOYEE_RATE_MINOR = 1900;
const DEFAULT_CLIENT_RATE_MINOR = 2300;

const DEMO_EMPLOYEES = [
  { fullName: "Raquel", pin: "111111" },
  { fullName: "Deiber", pin: "222222" },
  { fullName: "Yunior", pin: "333333" },
  { fullName: "Steven", pin: "444444" },
  { fullName: "Bruna", pin: "555555" },
  { fullName: "Alexander", pin: "666666" }
] as const;

const DEMO_KIOSK_NAME = "NH Hudson Kiosk";
const DEMO_KIOSK_SECRET = "demo-kiosk-secret-dev";
const DEMO_CATALOG_ITEMS = [
  {
    name: "Mechanic",
    description: "Mecánica",
    fixedPriceMinor: 5000,
    category: "Service",
    legacyNames: ["Basic wash"]
  },
  {
    name: "Bodyshop",
    description: "Bodyshop",
    fixedPriceMinor: 5000,
    category: "Service",
    legacyNames: ["Interior detail"]
  },
  {
    name: "Detail",
    description: "Detail",
    fixedPriceMinor: 5000,
    category: "Service",
    legacyNames: ["Pre-rental inspection"]
  },
  {
    name: "Paint",
    description: "Pintura",
    fixedPriceMinor: 5000,
    category: "Service"
  }
] as const;
const DEMO_OWNER_EMAIL = "mario@gmail.com";
const LEGACY_DEMO_OWNER_EMAIL = "owner@laborledger.test";
const DEMO_ADMIN_EMAIL = "admin@laborledger.test";
const DEMO_AUTH_PASSWORD = "DemoPass!123";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assertDevOnly() {
  if (process.env.NODE_ENV === "production") {
    fail("Demo seed is for local development only. Refusing to run in production.");
  }
}

function assertRequiredEnv() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const superadminEmail = process.env.PLATFORM_SUPERADMIN_EMAIL?.trim().toLowerCase();

  if (!databaseUrl) {
    fail(
      "DATABASE_URL is required. Copy .env.example to .env or export DATABASE_URL before running pnpm seed:demo."
    );
  }

  if (!superadminEmail) {
    fail(
      "PLATFORM_SUPERADMIN_EMAIL is required. Copy .env.example to .env or export PLATFORM_SUPERADMIN_EMAIL before running pnpm seed:demo."
    );
  }

  return { databaseUrl, superadminEmail };
}

async function hashPassword(password: string) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

async function ensureSuperadmin(prisma: PrismaClient, email: string) {
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    return existing;
  }

  const password = process.env.PLATFORM_SUPERADMIN_PASSWORD?.trim();
  if (!password) {
    fail(
      `Platform superadmin user "${email}" was not found. Set PLATFORM_SUPERADMIN_PASSWORD in .env (or export it) so this seed can create the dev superadmin, then run pnpm seed:demo again.`
    );
  }

  const fullName = process.env.PLATFORM_SUPERADMIN_NAME?.trim() || "Platform Superadmin";
  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      globalRole: GlobalRole.PLATFORM_SUPERADMIN
    }
  });
}

async function migrateLegacyDemoOwnerEmail(
  tx: Prisma.TransactionClient,
  input: {
    targetEmail: string;
    legacyEmail: string;
    groupId: string;
  }
) {
  const targetEmail = input.targetEmail.trim().toLowerCase();
  const legacyEmail = input.legacyEmail.trim().toLowerCase();

  if (targetEmail === legacyEmail) {
    return;
  }

  const [targetUser, legacyUser] = await Promise.all([
    tx.user.findUnique({ where: { email: targetEmail } }),
    tx.user.findUnique({ where: { email: legacyEmail } })
  ]);

  if (legacyUser && targetUser) {
    fail(
      `Demo owner email migration blocked: both "${legacyEmail}" and "${targetEmail}" exist. Remove or merge one user manually, then run pnpm seed:demo again.`
    );
  }

  if (!legacyUser) {
    return;
  }

  await tx.user.update({
    where: { id: legacyUser.id },
    data: { email: targetEmail }
  });

  await tx.groupMembership.updateMany({
    where: {
      groupId: input.groupId,
      email: legacyEmail
    },
    data: { email: targetEmail }
  });

  await tx.companyMembership.updateMany({
    where: { email: legacyEmail },
    data: { email: targetEmail }
  });
}

async function ensureDemoAuthUser(
  tx: Prisma.TransactionClient,
  input: {
    email: string;
    fullName: string;
    password: string;
    groupId?: string;
    groupRole?: GroupRole;
    companyId?: string;
    companyRole?: CompanyRole;
  }
) {
  const passwordHash = await hashPassword(input.password);
  const email = input.email.trim().toLowerCase();

  const user = await tx.user.upsert({
    where: { email },
    create: {
      email,
      fullName: input.fullName,
      passwordHash,
      globalRole: GlobalRole.NONE
    },
    update: {
      fullName: input.fullName,
      passwordHash
    }
  });

  if (input.groupId && input.groupRole) {
    await tx.groupMembership.upsert({
      where: {
        groupId_email: {
          groupId: input.groupId,
          email
        }
      },
      create: {
        groupId: input.groupId,
        userId: user.id,
        email,
        role: input.groupRole,
        status: MembershipStatus.ACTIVE
      },
      update: {
        userId: user.id,
        role: input.groupRole,
        status: MembershipStatus.ACTIVE
      }
    });
  }

  if (input.companyId && input.companyRole) {
    await tx.companyMembership.upsert({
      where: {
        companyId_email: {
          companyId: input.companyId,
          email
        }
      },
      create: {
        companyId: input.companyId,
        userId: user.id,
        email,
        role: input.companyRole,
        status: MembershipStatus.ACTIVE
      },
      update: {
        userId: user.id,
        role: input.companyRole,
        status: MembershipStatus.ACTIVE
      }
    });
  }

  return user;
}

async function hashPin(pin: string) {
  return argon2.hash(pin, ARGON2_OPTIONS);
}

async function ensurePinUniqueInCompany(
  tx: Prisma.TransactionClient,
  companyId: string,
  pin: string,
  employeeIdToIgnore?: string
) {
  const activeCredentials = await tx.employeePinCredential.findMany({
    where: {
      companyId,
      revokedAt: null,
      employee: {
        archivedAt: null
      },
      ...(employeeIdToIgnore ? { employeeId: { not: employeeIdToIgnore } } : {})
    },
    select: {
      pinHash: true
    }
  });

  for (const credential of activeCredentials) {
    const isSame = await argon2.verify(credential.pinHash, pin);
    if (isSame) {
      fail(`Employee PIN must be unique within the company. Conflicting demo PIN for company ${companyId}.`);
    }
  }
}

async function ensureDefaultClientRate(
  tx: Prisma.TransactionClient,
  companyId: string,
  serviceClientId: string,
  createdByUserId: string
) {
  const existingRate = await tx.clientLaborRate.findFirst({
    where: {
      companyId,
      serviceClientId,
      locationId: null
    }
  });

  if (existingRate) {
    return existingRate;
  }

  return tx.clientLaborRate.create({
    data: {
      companyId,
      serviceClientId,
      rateMinorUnits: DEFAULT_CLIENT_RATE_MINOR,
      currencyCode: "USD",
      effectiveStart: new Date(),
      createdByUserId
    }
  });
}

async function ensureServiceClient(
  tx: Prisma.TransactionClient,
  input: {
    groupId: string;
    companyId: string;
    name: string;
    legacyNames?: readonly string[];
  }
) {
  const namesToMatch = [input.name, ...(input.legacyNames ?? [])];
  let serviceClient = await tx.serviceClient.findFirst({
    where: {
      companyId: input.companyId,
      name: { in: [...namesToMatch] },
      archivedAt: null
    }
  });

  if (!serviceClient) {
    serviceClient = await tx.serviceClient.create({
      data: {
        groupId: input.groupId,
        companyId: input.companyId,
        name: input.name
      }
    });
  } else if (serviceClient.name !== input.name) {
    serviceClient = await tx.serviceClient.update({
      where: { id: serviceClient.id },
      data: { name: input.name }
    });
  }

  return serviceClient;
}

async function ensureLocation(
  tx: Prisma.TransactionClient,
  input: {
    groupId: string;
    companyId: string;
    serviceClientId: string;
    name: string;
    timezone: string;
    legacyNames?: readonly string[];
  }
) {
  const namesToMatch = [input.name, ...(input.legacyNames ?? [])];
  let location = await tx.location.findFirst({
    where: {
      companyId: input.companyId,
      name: { in: [...namesToMatch] },
      archivedAt: null
    }
  });

  if (!location) {
    location = await tx.location.create({
      data: {
        groupId: input.groupId,
        companyId: input.companyId,
        serviceClientId: input.serviceClientId,
        name: input.name,
        timezone: input.timezone
      }
    });
  } else if (location.name !== input.name || location.serviceClientId !== input.serviceClientId) {
    location = await tx.location.update({
      where: { id: location.id },
      data: {
        name: input.name,
        serviceClientId: input.serviceClientId,
        timezone: input.timezone
      }
    });
  }

  return location;
}

async function ensureDemoServiceClients(
  tx: Prisma.TransactionClient,
  input: {
    groupId: string;
    companyId: string;
    clients: readonly DemoServiceClientSeed[];
    createdByUserId: string;
    timezone: string;
  }
) {
  const seeded: Array<{
    serviceClient: Awaited<ReturnType<typeof ensureServiceClient>>;
    location: Awaited<ReturnType<typeof ensureLocation>> | null;
  }> = [];

  for (const demoClient of input.clients) {
    const serviceClient = await ensureServiceClient(tx, {
      groupId: input.groupId,
      companyId: input.companyId,
      name: demoClient.clientName,
      ...(demoClient.legacyClientNames ? { legacyNames: demoClient.legacyClientNames } : {})
    });

    await ensureDefaultClientRate(tx, input.companyId, serviceClient.id, input.createdByUserId);

    if (demoClient.locationName) {
      const location = await ensureLocation(tx, {
        groupId: input.groupId,
        companyId: input.companyId,
        serviceClientId: serviceClient.id,
        name: demoClient.locationName,
        timezone: input.timezone,
        ...(demoClient.legacyLocationNames ? { legacyNames: demoClient.legacyLocationNames } : {})
      });

      seeded.push({ serviceClient, location });
    } else {
      seeded.push({ serviceClient, location: null });
    }
  }

  return seeded;
}

async function ensureEmployee(
  tx: Prisma.TransactionClient,
  input: {
    groupId: string;
    companyId: string;
    fullName: string;
    pin: string;
    createdByUserId: string;
  }
) {
  let employee = await tx.employee.findFirst({
    where: {
      companyId: input.companyId,
      fullName: input.fullName,
      archivedAt: null
    }
  });

  if (!employee) {
    await ensurePinUniqueInCompany(tx, input.companyId, input.pin);

    const pinHash = await hashPin(input.pin);

    employee = await tx.employee.create({
      data: {
        groupId: input.groupId,
        companyId: input.companyId,
        fullName: input.fullName
      }
    });

    await tx.employeePinCredential.create({
      data: {
        employeeId: employee.id,
        companyId: input.companyId,
        pinHash,
        createdByUserId: input.createdByUserId
      }
    });

    await tx.employeeRate.create({
      data: {
        employeeId: employee.id,
        companyId: input.companyId,
        rateMinorUnits: DEFAULT_EMPLOYEE_RATE_MINOR,
        currencyCode: "USD",
        effectiveStart: new Date(),
        createdByUserId: input.createdByUserId
      }
    });

    return { employee, created: true };
  }

  const activePin = await tx.employeePinCredential.findFirst({
    where: {
      employeeId: employee.id,
      companyId: input.companyId,
      revokedAt: null
    }
  });

  if (!activePin) {
    await ensurePinUniqueInCompany(tx, input.companyId, input.pin, employee.id);
    const pinHash = await hashPin(input.pin);
    await tx.employeePinCredential.create({
      data: {
        employeeId: employee.id,
        companyId: input.companyId,
        pinHash,
        createdByUserId: input.createdByUserId
      }
    });
  }

  const existingRate = await tx.employeeRate.findFirst({
    where: {
      employeeId: employee.id,
      companyId: input.companyId
    }
  });

  if (!existingRate) {
    await tx.employeeRate.create({
      data: {
        employeeId: employee.id,
        companyId: input.companyId,
        rateMinorUnits: DEFAULT_EMPLOYEE_RATE_MINOR,
        currencyCode: "USD",
        effectiveStart: new Date(),
        createdByUserId: input.createdByUserId
      }
    });
  }

  return { employee, created: false };
}

async function ensureKiosk(
  tx: Prisma.TransactionClient,
  input: {
    groupId: string;
    companyId: string;
    locationId: string;
    name: string;
    secret: string;
  }
) {
  let kiosk = await tx.kiosk.findFirst({
    where: {
      locationId: input.locationId,
      archivedAt: null
    }
  });

  if (!kiosk) {
    kiosk = await tx.kiosk.create({
      data: {
        groupId: input.groupId,
        companyId: input.companyId,
        locationId: input.locationId,
        name: input.name
      }
    });
  } else if (kiosk.name !== input.name) {
    kiosk = await tx.kiosk.update({
      where: { id: kiosk.id },
      data: { name: input.name }
    });
  }

  const secretHash = await hashPin(input.secret);
  const existingCredential = await tx.kioskCredential.findUnique({
    where: { kioskId: kiosk.id }
  });

  if (!existingCredential) {
    await tx.kioskCredential.create({
      data: {
        kioskId: kiosk.id,
        secretHash
      }
    });
  } else {
    await tx.kioskCredential.update({
      where: { kioskId: kiosk.id },
      data: { secretHash, revokedAt: null }
    });
  }

  return kiosk;
}

async function ensureDemoServiceCatalog(
  tx: Prisma.TransactionClient,
  input: { groupId: string; companyId: string }
) {
  for (const item of DEMO_CATALOG_ITEMS) {
    const namesToMatch = [item.name, ...("legacyNames" in item && item.legacyNames ? item.legacyNames : [])];
    let existing = await tx.serviceCatalogItem.findFirst({
      where: {
        companyId: input.companyId,
        name: { in: [...namesToMatch] },
        archivedAt: null
      }
    });

    if (!existing) {
      await tx.serviceCatalogItem.create({
        data: {
          groupId: input.groupId,
          companyId: input.companyId,
          name: item.name,
          description: item.description,
          category: item.category,
          fixedPriceMinor: item.fixedPriceMinor
        }
      });
      continue;
    }

    if (
      existing.name !== item.name ||
      existing.description !== item.description ||
      existing.category !== item.category
    ) {
      await tx.serviceCatalogItem.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          description: item.description,
          category: item.category,
          fixedPriceMinor: item.fixedPriceMinor
        }
      });
    }
  }
}

async function main() {
  assertDevOnly();
  const { databaseUrl, superadminEmail } = assertRequiredEnv();

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  try {
    const superadmin = await ensureSuperadmin(prisma, superadminEmail);

    const result = await prisma.$transaction(
      async (tx) => {
      let group = await tx.group.findFirst({
        where: {
          OR: [{ name: DEMO_GROUP_NAME }, { name: LEGACY_DEMO_GROUP_NAME }]
        }
      });

      if (!group) {
        group = await tx.group.create({
          data: { name: DEMO_GROUP_NAME }
        });
      } else if (group.name !== DEMO_GROUP_NAME) {
        group = await tx.group.update({
          where: { id: group.id },
          data: { name: DEMO_GROUP_NAME }
        });
      }

      let company = await tx.company.findFirst({
        where: {
          groupId: group.id,
          name: DEMO_COMPANY_NAME
        }
      });

      if (!company) {
        for (const legacyName of LEGACY_DEMO_COMPANY_NAMES) {
          company = await tx.company.findFirst({
            where: {
              groupId: group.id,
              name: legacyName
            }
          });
          if (company) {
            break;
          }
        }
      }

      if (!company) {
        company = await tx.company.create({
          data: {
            groupId: group.id,
            name: DEMO_COMPANY_NAME
          }
        });
      } else if (company.name !== DEMO_COMPANY_NAME) {
        company = await tx.company.update({
          where: { id: company.id },
          data: { name: DEMO_COMPANY_NAME }
        });
      }

      await migrateLegacyDemoOwnerEmail(tx, {
        targetEmail: DEMO_OWNER_EMAIL,
        legacyEmail: LEGACY_DEMO_OWNER_EMAIL,
        groupId: group.id
      });

      await ensureDemoAuthUser(tx, {
        email: DEMO_OWNER_EMAIL,
        fullName: "Mario Rodriguez",
        password: DEMO_AUTH_PASSWORD,
        groupId: group.id,
        groupRole: GroupRole.GROUP_OWNER
      });

      await ensureDemoAuthUser(tx, {
        email: DEMO_ADMIN_EMAIL,
        fullName: "Demo Company Admin",
        password: DEMO_AUTH_PASSWORD,
        companyId: company.id,
        companyRole: CompanyRole.COMPANY_ADMIN
      });

      await tx.companyMembership.upsert({
        where: {
          companyId_email: {
            companyId: company.id,
            email: superadmin.email
          }
        },
        create: {
          companyId: company.id,
          userId: superadmin.id,
          email: superadmin.email,
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.ACTIVE
        },
        update: {
          userId: superadmin.id,
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.ACTIVE
        }
      });

      const demoServiceClients = await ensureDemoServiceClients(tx, {
        groupId: group.id,
        companyId: company.id,
        clients: DEMO_SERVICE_CLIENTS,
        createdByUserId: superadmin.id,
        timezone: DEMO_LOCATION_TIMEZONE
      });

      const primaryLocation = demoServiceClients.find((entry) => entry.location)?.location;
      if (!primaryLocation) {
        fail("Demo service client seed did not create a location.");
      }

      await ensureDemoServiceCatalog(tx, {
        groupId: group.id,
        companyId: company.id
      });

      const employeeResults = [];
      for (const demoEmployee of DEMO_EMPLOYEES) {
        employeeResults.push(
          await ensureEmployee(tx, {
            groupId: group.id,
            companyId: company.id,
            fullName: demoEmployee.fullName,
            pin: demoEmployee.pin,
            createdByUserId: superadmin.id
          })
        );
      }

      const kiosk = await ensureKiosk(tx, {
        groupId: group.id,
        companyId: company.id,
        locationId: primaryLocation.id,
        name: DEMO_KIOSK_NAME,
        secret: DEMO_KIOSK_SECRET
      });

      const primaryEmployees = employeeResults.map((entry) => ({
        employeeId: entry.employee.id,
        fullName: entry.employee.fullName
      }));

      const employeeIdByName = new Map(
        employeeResults.map((entry) => [entry.employee.fullName, entry.employee.id] as const)
      );
      const raquelId = employeeIdByName.get("Raquel");
      const deiberId = employeeIdByName.get("Deiber");
      const brunaId = employeeIdByName.get("Bruna");

      const seededLocations = demoServiceClients.flatMap((entry) =>
        entry.location
          ? [{ locationId: entry.location.id, serviceClientId: entry.serviceClient.id }]
          : []
      );

      const primaryTimekeepingPrior = await ensureDemoTimekeepingWeek(tx, {
        groupId: group.id,
        companyId: company.id,
        kioskId: kiosk.id,
        approvedByUserId: superadmin.id,
        timezone: DEMO_LOCATION_TIMEZONE,
        employees: primaryEmployees,
        locations: seededLocations,
        weekStartOffset: -1
      });

      const primaryTimekeeping = await ensureDemoTimekeepingWeek(tx, {
        groupId: group.id,
        companyId: company.id,
        kioskId: kiosk.id,
        approvedByUserId: superadmin.id,
        timezone: DEMO_LOCATION_TIMEZONE,
        employees: primaryEmployees,
        locations: seededLocations,
        weekStartOffset: 0,
        activeTodayEmployeeIds: [raquelId, deiberId, brunaId].filter((id): id is string => Boolean(id)),
        activeTodayModes: {
          ...(raquelId ? { [raquelId]: "scheduled" as const } : {}),
          ...(brunaId ? { [brunaId]: "on_break" as const } : {})
        }
      });

      return {
        group,
        company,
        demoServiceClients,
        primaryLocation,
        employeeResults,
        kiosk,
        primaryTimekeepingPrior,
        primaryTimekeeping
      };
    },
      { maxWait: 60_000, timeout: 120_000 }
    );

    const createdEmployees = result.employeeResults.filter((entry) => entry.created).length;
    const reusedEmployees = result.employeeResults.length - createdEmployees;

    console.log("Demo seed completed.");
    console.log(`Group: ${result.group.name}`);
    console.log(`Company: ${result.company.name}`);
    console.log("Service clients:");
    for (const entry of result.demoServiceClients) {
      const locationLabel = entry.location ? ` — ${entry.location.name}` : "";
      console.log(`  ${entry.serviceClient.name}${locationLabel}`);
    }
    console.log(`Primary kiosk location: ${result.primaryLocation.name} (${result.primaryLocation.timezone})`);
    console.log(`Service catalog items ready: ${DEMO_CATALOG_ITEMS.length} (${DEMO_CATALOG_ITEMS.map((item) => item.name).join(", ")})`);
    console.log(
      `${result.company.name} employees: ${result.employeeResults.length} (${createdEmployees} created, ${reusedEmployees} reused)`
    );
    console.log(`Superadmin access: ${superadminEmail}`);
    console.log("Admin login demo users (dev only, email/password):");
    console.log(`  Mario (group owner): ${DEMO_OWNER_EMAIL} / ${DEMO_AUTH_PASSWORD}`);
    console.log(`  Company admin (${result.company.name} only): ${DEMO_ADMIN_EMAIL} / ${DEMO_AUTH_PASSWORD}`);
    console.log(`Demo employee PINs — ${result.company.name} (dev only):`);
    for (const demoEmployee of DEMO_EMPLOYEES) {
      console.log(`  ${demoEmployee.fullName}: ${demoEmployee.pin}`);
    }
    console.log(`Primary kiosk ID (dev only): ${result.kiosk.id}`);
    console.log(`Kiosk secret (dev only): ${DEMO_KIOSK_SECRET}`);
    console.log(
      `Timekeeping prior week (${result.primaryTimekeepingPrior.weekStartLocalDate}): ${result.company.name} — ${result.primaryTimekeepingPrior.shiftCount} shifts (${result.primaryTimekeepingPrior.approvedShiftCount} approved, ${result.primaryTimekeepingPrior.punchEventCount} new punches)`
    );
    console.log(
      `Timekeeping current week (${result.primaryTimekeeping.weekStartLocalDate}): ${result.company.name} — ${result.primaryTimekeeping.shiftCount} shifts (${result.primaryTimekeeping.approvedShiftCount} approved, ${result.primaryTimekeeping.punchEventCount} new punches); full Mon–Sun schedule; Raquel scheduled today (clock-in ready), Deiber clocked in, Bruna on break`
    );
    console.log("Open /review and /weekly-close in admin to inspect worked hours, breaks, and gross-pay estimates.");
    console.log("Set KIOSK_ID, KIOSK_SECRET, and WORKER_COMPANY_ID in apps/field/.env.local for Field clock testing.");
    console.log("Open http://localhost:3000/login for admin email/password login.");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  if (error instanceof Error && error.message.includes("Can't reach database server")) {
    fail(
      "PostgreSQL is not reachable. Verify DATABASE_URL in .env points at your running Postgres server, then run pnpm seed:demo again."
    );
  }

  console.error("Demo seed failed.");
  console.error(error);
  process.exit(1);
});
