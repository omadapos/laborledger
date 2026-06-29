import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import {
  LaborWorkAssignmentStatus,
  LaborWorkProgressStatus,
  ShiftStatus,
  type Prisma
} from "@prisma/client";
import * as argon2 from "argon2";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { GroupAccessService } from "../identity-access/group-access.service";
import { PrismaService } from "../identity-access/prisma.service";
import { validateVin } from "../vin-decode/vin-validation";

import {
  ACTIVE_LABOR_WORK_STATUSES,
  VALID_PROGRESS_PERCENTS,
  computeReferenceMinutes,
  findActiveClockedInShift,
  mapLaborWorkAssignment,
  shiftClockInUtc
} from "./labor-work-assignment.utils";

const PIN_PATTERN = /^\d{6}$/u;

type FieldAuthInput = {
  companyId: string;
  pin: string;
};

type StartLaborWorkInput = FieldAuthInput & {
  serviceClientId: string;
  locationId: string;
  serviceCatalogItemId: string;
  vehicleId?: string;
  vin?: string;
  notes?: string;
};

type ProgressLaborWorkInput = {
  progressPercent?: number;
  progressStatus?: LaborWorkProgressStatus;
  referenceAction?: "prep_start" | "prep_complete" | "wash_start" | "wash_complete";
  notes?: string;
};

type BlockLaborWorkInput = {
  blockedReason: string;
};

type AdminListQuery = {
  locationId?: string;
  employeeId?: string;
  serviceClientId?: string;
  status?: LaborWorkAssignmentStatus;
  from?: string;
  to?: string;
};

type AdminPatchInput = {
  notes?: string;
  status?: LaborWorkAssignmentStatus;
};

@Injectable()
export class LaborWorkAssignmentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupAccessService) private readonly groupAccessService: GroupAccessService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService
  ) {}

  async getActiveAssignment(input: FieldAuthInput) {
    const { companyId, employee } = await this.authenticateFieldEmployee(input);
    const assignment = await this.findActiveAssignment(companyId, employee.id);

    return {
      clockedIn: Boolean(await this.resolveActiveShift(companyId, employee.id)),
      assignment: assignment ? mapLaborWorkAssignment(assignment) : null,
      message: assignment
        ? null
        : "No active work assignment. Start one after clock-in to track operational progress."
    };
  }

  async getAvailableOptions(input: FieldAuthInput) {
    const { company, employee } = await this.authenticateFieldEmployee(input);

    const [serviceClients, locations, serviceCatalogItems, vehicles] = await Promise.all([
      this.prisma.serviceClient.findMany({
        where: { companyId: company.id, archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      }),
      this.prisma.location.findMany({
        where: { companyId: company.id, archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, serviceClientId: true }
      }),
      this.prisma.serviceCatalogItem.findMany({
        where: { companyId: company.id, archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, category: true }
      }),
      this.prisma.vehicle.findMany({
        where: { companyId: company.id, archivedAt: null },
        orderBy: { vin: "asc" },
        select: { id: true, vin: true, serviceClientId: true, locationId: true }
      })
    ]);

    return {
      employee: { id: employee.id, fullName: employee.fullName },
      company: { id: company.id, name: company.name },
      serviceClients,
      locations,
      serviceCatalogItems,
      vehicles
    };
  }

  async startAssignment(input: StartLaborWorkInput) {
    const { company, employee } = await this.authenticateFieldEmployee(input);
    const activeShift = await this.requireActiveShift(company.id, employee.id);

    const existing = await this.findActiveAssignment(company.id, employee.id);
    if (existing) {
      throw new BadRequestException("You already have an active work assignment.");
    }

    const serviceClientId = input.serviceClientId.trim();
    const locationId = input.locationId.trim();
    const serviceCatalogItemId = input.serviceCatalogItemId.trim();

    const [serviceClient, location, catalogItem, vehicle] = await Promise.all([
      this.prisma.serviceClient.findUnique({ where: { id: serviceClientId } }),
      this.prisma.location.findUnique({ where: { id: locationId } }),
      this.prisma.serviceCatalogItem.findUnique({ where: { id: serviceCatalogItemId } }),
      input.vehicleId?.trim()
        ? this.prisma.vehicle.findUnique({ where: { id: input.vehicleId.trim() } })
        : Promise.resolve(null)
    ]);

    this.assertCompanyEntity(serviceClient, company.id, "Service client");
    this.assertCompanyEntity(location, company.id, "Location");
    this.assertCompanyEntity(catalogItem, company.id, "Service");

    if (location!.serviceClientId !== serviceClientId) {
      throw new BadRequestException("Location does not belong to the selected service client.");
    }

    let vinSnapshot: string | null = null;
    if (input.vin?.trim()) {
      const vinValidation = validateVin(input.vin);
      if ("error" in vinValidation) {
        throw new BadRequestException(vinValidation.error);
      }
      vinSnapshot = vinValidation.vin;
    }

    if (vehicle) {
      this.assertCompanyEntity(vehicle, company.id, "Vehicle");
      if (vehicle.serviceClientId !== serviceClientId || vehicle.locationId !== locationId) {
        throw new BadRequestException("Vehicle does not match the selected client and location.");
      }
      vinSnapshot = vinSnapshot ?? vehicle.vin;
    }

    const now = new Date();
    const assignment = await this.prisma.laborWorkAssignment.create({
      data: {
        groupId: company.groupId,
        companyId: company.id,
        employeeId: employee.id,
        shiftId: activeShift.id,
        serviceClientId,
        locationId,
        serviceCatalogItemId,
        vehicleId: vehicle?.id ?? null,
        vinSnapshot,
        employeeNameSnapshot: employee.fullName,
        clientNameSnapshot: serviceClient!.name,
        locationNameSnapshot: location!.name,
        addressSnapshot: location!.name,
        serviceNameSnapshot: catalogItem!.name,
        status: LaborWorkAssignmentStatus.IN_PROGRESS,
        progressPercent: 0,
        progressStatus: LaborWorkProgressStatus.STARTED,
        startedAt: now,
        notes: this.normalizeOptionalText(input.notes)
      }
    });

    return {
      assignment: mapLaborWorkAssignment(assignment),
      message: "Work started. Billable hours still come from approved clock/punch time."
    };
  }

  async updateProgress(assignmentId: string, input: FieldAuthInput, body: ProgressLaborWorkInput) {
    const { companyId, employee } = await this.authenticateFieldEmployee(input);
    const assignment = await this.requireOwnedAssignment(assignmentId, companyId, employee.id);

    if (assignment.status !== LaborWorkAssignmentStatus.IN_PROGRESS) {
      throw new BadRequestException("Only in-progress work can be updated.");
    }

    const now = new Date();
    const data: Prisma.LaborWorkAssignmentUpdateInput = {};

    if (body.progressPercent !== undefined) {
      if (!VALID_PROGRESS_PERCENTS.includes(body.progressPercent as (typeof VALID_PROGRESS_PERCENTS)[number])) {
        throw new BadRequestException("progressPercent must be one of 0, 25, 50, 75, or 100.");
      }
      data.progressPercent = body.progressPercent;
    }

    if (body.progressStatus) {
      data.progressStatus = body.progressStatus;
    }

    if (body.notes !== undefined) {
      data.notes = this.normalizeOptionalText(body.notes);
    }

    switch (body.referenceAction) {
      case "prep_start":
        data.referencePrepStartedAt = now;
        data.progressStatus = LaborWorkProgressStatus.PREP_IN_PROGRESS;
        break;
      case "prep_complete":
        data.referencePrepCompletedAt = now;
        break;
      case "wash_start":
        data.referenceWashStartedAt = now;
        data.progressStatus = LaborWorkProgressStatus.WASH_IN_PROGRESS;
        break;
      case "wash_complete":
        data.referenceWashCompletedAt = now;
        break;
      default:
        break;
    }

    const updated = await this.prisma.laborWorkAssignment.update({
      where: { id: assignment.id },
      data
    });

    return { assignment: mapLaborWorkAssignment(updated) };
  }

  async completeAssignment(assignmentId: string, input: FieldAuthInput) {
    const { companyId, employee } = await this.authenticateFieldEmployee(input);
    const assignment = await this.requireOwnedAssignment(assignmentId, companyId, employee.id);

    if (
      assignment.status !== LaborWorkAssignmentStatus.IN_PROGRESS &&
      assignment.status !== LaborWorkAssignmentStatus.BLOCKED
    ) {
      throw new BadRequestException("Only active or blocked work can be completed.");
    }

    const completedAt = new Date();
    const reference = computeReferenceMinutes({
      referencePrepStartedAt: assignment.referencePrepStartedAt,
      referencePrepCompletedAt: assignment.referencePrepCompletedAt,
      referenceWashStartedAt: assignment.referenceWashStartedAt,
      referenceWashCompletedAt: assignment.referenceWashCompletedAt,
      startedAt: assignment.startedAt,
      completedAt
    });

    const updated = await this.prisma.laborWorkAssignment.update({
      where: { id: assignment.id },
      data: {
        status: LaborWorkAssignmentStatus.COMPLETED,
        progressPercent: 100,
        progressStatus: LaborWorkProgressStatus.COMPLETED,
        completedAt,
        ...reference
      }
    });

    return { assignment: mapLaborWorkAssignment(updated) };
  }

  async blockAssignment(assignmentId: string, input: FieldAuthInput, body: BlockLaborWorkInput) {
    const blockedReason = body.blockedReason?.trim() ?? "";
    if (!blockedReason) {
      throw new BadRequestException("blockedReason is required.");
    }

    const { companyId, employee } = await this.authenticateFieldEmployee(input);
    const assignment = await this.requireOwnedAssignment(assignmentId, companyId, employee.id);

    if (assignment.status !== LaborWorkAssignmentStatus.IN_PROGRESS) {
      throw new BadRequestException("Only in-progress work can be blocked.");
    }

    const updated = await this.prisma.laborWorkAssignment.update({
      where: { id: assignment.id },
      data: {
        status: LaborWorkAssignmentStatus.BLOCKED,
        progressStatus: LaborWorkProgressStatus.BLOCKED,
        blockedAt: new Date(),
        blockedReason
      }
    });

    return { assignment: mapLaborWorkAssignment(updated) };
  }

  async cancelAssignment(assignmentId: string, input: FieldAuthInput) {
    const { companyId, employee } = await this.authenticateFieldEmployee(input);
    const assignment = await this.requireOwnedAssignment(assignmentId, companyId, employee.id);

    if (
      assignment.status !== LaborWorkAssignmentStatus.IN_PROGRESS &&
      assignment.status !== LaborWorkAssignmentStatus.BLOCKED
    ) {
      throw new BadRequestException("Only active or blocked work can be cancelled.");
    }

    const updated = await this.prisma.laborWorkAssignment.update({
      where: { id: assignment.id },
      data: {
        status: LaborWorkAssignmentStatus.CANCELLED,
        cancelledAt: new Date()
      }
    });

    return { assignment: mapLaborWorkAssignment(updated) };
  }

  async listForAdmin(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: AdminListQuery
  ) {
    const access = await this.companyScopeService.getCompanyAccessContext(principal, companyId);

    const assignments = await this.prisma.laborWorkAssignment.findMany({
      where: {
        companyId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.serviceClientId ? { serviceClientId: query.serviceClientId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to
          ? {
              startedAt: {
                ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
                ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {})
              }
            }
          : {}),
        ...this.companyScopeService.buildLocationIdFilter(access, query.locationId)
      },
      include: {
        shift: {
          select: {
            id: true,
            scheduledStartUtc: true,
            scheduledEndUtc: true,
            punchEvents: { orderBy: { eventUtc: "asc" } }
          }
        }
      },
      orderBy: [{ startedAt: "desc" }]
    });

    return {
      items: assignments.map((assignment) => ({
        ...mapLaborWorkAssignment(assignment),
        shiftScheduledStartUtc: assignment.shift.scheduledStartUtc.toISOString(),
        shiftScheduledEndUtc: assignment.shift.scheduledEndUtc.toISOString(),
        shiftClockInUtc: shiftClockInUtc(assignment.shift.punchEvents)?.toISOString() ?? null
      })),
      billingSourceReminder:
        "Service times are reference only. Labor billing uses approved clock/punch hours."
    };
  }

  async exportCsvForAdmin(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: AdminListQuery
  ) {
    const result = await this.listForAdmin(principal, companyId, query);
    const header = [
      "worker",
      "client",
      "address",
      "service",
      "shift_scheduled_start",
      "work_started",
      "work_completed",
      "status",
      "progress_percent",
      "reference_prep_minutes",
      "reference_wash_minutes",
      "reference_service_minutes",
      "notes",
      "billing_source_reminder"
    ].join(",");

    const lines = result.items.map((row) =>
      [
        this.escapeCsv(row.employeeName),
        this.escapeCsv(row.clientName),
        this.escapeCsv(row.address),
        this.escapeCsv(row.serviceName),
        this.escapeCsv(row.shiftScheduledStartUtc),
        this.escapeCsv(row.startedAt),
        this.escapeCsv(row.completedAt ?? ""),
        this.escapeCsv(row.status),
        this.escapeCsv(row.progressPercent),
        this.escapeCsv(row.referencePrepMinutes ?? ""),
        this.escapeCsv(row.referenceWashMinutes ?? ""),
        this.escapeCsv(row.referenceServiceMinutes ?? ""),
        this.escapeCsv(row.notes ?? ""),
        this.escapeCsv(result.billingSourceReminder)
      ].join(",")
    );

    return [header, ...lines].join("\n");
  }

  async patchForAdmin(
    principal: AuthenticatedPrincipal,
    companyId: string,
    assignmentId: string,
    input: AdminPatchInput
  ) {
    const access = await this.companyScopeService.getCompanyAccessContext(principal, companyId);

    const assignment = await this.prisma.laborWorkAssignment.findFirst({
      where: {
        id: assignmentId,
        companyId,
        ...this.companyScopeService.buildLocationIdFilter(access)
      }
    });

    if (!assignment) {
      throw new NotFoundException("Labor work assignment not found.");
    }

    const updated = await this.prisma.laborWorkAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(input.notes !== undefined ? { notes: this.normalizeOptionalText(input.notes) } : {}),
        ...(input.status ? { status: input.status } : {})
      }
    });

    return { assignment: mapLaborWorkAssignment(updated) };
  }

  async assertNoActiveWorkForClockOut(companyId: string, employeeId: string) {
    const active = await this.findActiveAssignment(companyId, employeeId);
    if (active) {
      throw new BadRequestException(
        "You have an active work assignment. Finish or block it before clocking out."
      );
    }
  }

  async findAssignmentsForBillingWindow(
    companyId: string,
    startedAtGte: Date,
    startedAtLt: Date,
    locationIds?: string[]
  ) {
    return this.prisma.laborWorkAssignment.findMany({
      where: {
        companyId,
        startedAt: { gte: startedAtGte, lt: startedAtLt },
        ...(locationIds ? { locationId: { in: locationIds } } : {})
      },
      orderBy: [{ startedAt: "asc" }]
    });
  }

  private async authenticateFieldEmployee(input: FieldAuthInput) {
    const companyId = input.companyId?.trim() ?? "";
    if (!companyId) {
      throw new BadRequestException("Company is required.");
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, groupId: true }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    await this.groupAccessService.assertCompanyTenantOperational(companyId);
    const employee = await this.resolveEmployeeByPin(companyId, input.pin);

    return { company, employee, companyId };
  }

  private async resolveEmployeeByPin(companyId: string, pin: string) {
    if (!PIN_PATTERN.test(pin ?? "")) {
      throw new BadRequestException("Employee PIN must be exactly 6 digits.");
    }

    const credentials = await this.prisma.employeePinCredential.findMany({
      where: {
        companyId,
        revokedAt: null,
        employee: { archivedAt: null }
      },
      include: { employee: true }
    });

    for (const credential of credentials) {
      const matches = await argon2.verify(credential.pinHash, pin);
      if (matches) {
        if (credential.employee.companyId !== companyId) {
          throw new ForbiddenException("Employee does not belong to this company.");
        }
        return credential.employee;
      }
    }

    throw new UnauthorizedException("PIN is invalid for this company.");
  }

  private async resolveActiveShift(companyId: string, employeeId: string) {
    const shifts = await this.prisma.shift.findMany({
      where: {
        companyId,
        employeeId,
        status: ShiftStatus.SCHEDULED,
        cancelledAt: null
      },
      include: {
        punchEvents: { orderBy: [{ eventUtc: "asc" }, { serverReceivedUtc: "asc" }] }
      },
      orderBy: { scheduledStartUtc: "desc" }
    });

    return findActiveClockedInShift(shifts);
  }

  private async requireActiveShift(companyId: string, employeeId: string) {
    const shift = await this.resolveActiveShift(companyId, employeeId);
    if (!shift) {
      throw new BadRequestException("Clock in before starting work.");
    }
    return shift;
  }

  private async findActiveAssignment(companyId: string, employeeId: string) {
    return this.prisma.laborWorkAssignment.findFirst({
      where: {
        companyId,
        employeeId,
        status: { in: [...ACTIVE_LABOR_WORK_STATUSES] }
      },
      orderBy: { startedAt: "desc" }
    });
  }

  private async requireOwnedAssignment(assignmentId: string, companyId: string, employeeId: string) {
    const assignment = await this.prisma.laborWorkAssignment.findFirst({
      where: { id: assignmentId, companyId, employeeId }
    });

    if (!assignment) {
      throw new NotFoundException("Labor work assignment not found.");
    }

    return assignment;
  }

  private assertCompanyEntity(
    entity: { companyId: string; archivedAt?: Date | null } | null,
    companyId: string,
    label: string
  ) {
    if (!entity || entity.archivedAt) {
      throw new NotFoundException(`${label} not found.`);
    }
    if (entity.companyId !== companyId) {
      throw new ForbiddenException(`${label} does not belong to this company.`);
    }
  }

  private normalizeOptionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private escapeCsv(value: string | number) {
    const text = String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}
