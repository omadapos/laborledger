import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CompanyRole, GlobalRole, GroupRole, MembershipStatus, Prisma } from "@prisma/client";

import type { AuthenticatedPrincipal } from "./auth.types";
import { GroupAccessService } from "./group-access.service";
import { PrismaService } from "./prisma.service";

export type CompanyAccessLevel = "platform" | "group_owner" | "company_admin" | "supervisor";

export type CompanyAccessContext = {
  company: {
    id: string;
    groupId: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  };
  accessLevel: CompanyAccessLevel;
  unrestrictedLocations: boolean;
  allowedLocationIds: string[];
  canManageCompany: boolean;
  canAccessWeeklyClose: boolean;
  canAccessKioskAdmin: boolean;
};

@Injectable()
export class CompanyScopeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupAccessService) private readonly groupAccessService: GroupAccessService
  ) {}

  private async assertTenantCompanyOperational(
    principal: AuthenticatedPrincipal,
    groupId: string
  ): Promise<void> {
    if (principal.globalRole === GlobalRole.PLATFORM_SUPERADMIN) {
      return;
    }

    await this.groupAccessService.assertTenantGroupOperational(groupId);
  }

  async requireManagementCompany(principal: AuthenticatedPrincipal, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    await this.assertTenantCompanyOperational(principal, company.groupId);

    if (principal.globalRole === GlobalRole.PLATFORM_SUPERADMIN) {
      return company;
    }

    const groupOwnerMembership = await this.prisma.groupMembership.findFirst({
      where: {
        groupId: company.groupId,
        userId: principal.userId,
        role: GroupRole.GROUP_OWNER,
        status: MembershipStatus.ACTIVE
      },
      select: { id: true }
    });

    if (groupOwnerMembership) {
      return company;
    }

    const companyAdminMembership = await this.prisma.companyMembership.findFirst({
      where: {
        companyId,
        userId: principal.userId,
        role: CompanyRole.COMPANY_ADMIN,
        status: MembershipStatus.ACTIVE
      },
      select: { id: true }
    });

    if (!companyAdminMembership) {
      throw new ForbiddenException("Management access denied for this company.");
    }

    return company;
  }

  async requireOperationalCompany(principal: AuthenticatedPrincipal, companyId: string) {
    const context = await this.getCompanyAccessContext(principal, companyId);
    return context.company;
  }

  async getCompanyAccessContext(
    principal: AuthenticatedPrincipal,
    companyId: string
  ): Promise<CompanyAccessContext> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    await this.assertTenantCompanyOperational(principal, company.groupId);

    if (principal.globalRole === GlobalRole.PLATFORM_SUPERADMIN) {
      return this.buildContext(company, "platform", null);
    }

    const groupOwnerMembership = await this.prisma.groupMembership.findFirst({
      where: {
        groupId: company.groupId,
        userId: principal.userId,
        role: GroupRole.GROUP_OWNER,
        status: MembershipStatus.ACTIVE
      },
      select: { id: true }
    });

    if (groupOwnerMembership) {
      return this.buildContext(company, "group_owner", null);
    }

    const companyAdminMembership = await this.prisma.companyMembership.findFirst({
      where: {
        companyId,
        userId: principal.userId,
        role: CompanyRole.COMPANY_ADMIN,
        status: MembershipStatus.ACTIVE
      },
      select: { id: true }
    });

    if (companyAdminMembership) {
      return this.buildContext(company, "company_admin", null);
    }

    const supervisorMembership = await this.prisma.companyMembership.findFirst({
      where: {
        companyId,
        userId: principal.userId,
        role: CompanyRole.SUPERVISOR,
        status: MembershipStatus.ACTIVE
      },
      select: { id: true }
    });

    if (!supervisorMembership) {
      throw new ForbiddenException("Access denied for this company.");
    }

    const allowedLocationIds = await this.loadSupervisorLocationIds(principal.userId, companyId);
    return this.buildContext(company, "supervisor", allowedLocationIds);
  }

  async assertLocationFilterAllowed(
    principal: AuthenticatedPrincipal,
    companyId: string,
    locationId?: string
  ) {
    if (!locationId) {
      return;
    }

    const context = await this.getCompanyAccessContext(principal, companyId);

    const location = await this.prisma.location.findFirst({
      where: { id: locationId, companyId },
      select: { id: true }
    });

    if (!location) {
      throw new BadRequestException("Location must belong to the selected company.");
    }

    if (context.unrestrictedLocations) {
      return;
    }

    if (!context.allowedLocationIds.includes(locationId)) {
      throw new ForbiddenException("Location access denied.");
    }
  }

  buildLocationEntityFilter(context: CompanyAccessContext): Prisma.LocationWhereInput {
    if (context.unrestrictedLocations) {
      return {};
    }

    return { id: { in: context.allowedLocationIds } };
  }

  buildLocationIdFilter(
    context: CompanyAccessContext,
    locationId?: string
  ): Prisma.ShiftWhereInput | Prisma.CorrectionRequestWhereInput {
    if (locationId) {
      return { locationId };
    }

    if (context.unrestrictedLocations) {
      return {};
    }

    return { locationId: { in: context.allowedLocationIds } };
  }

  async requireLocationAccess(principal: AuthenticatedPrincipal, locationId: string) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!location) {
      throw new NotFoundException("Location not found.");
    }

    const context = await this.getCompanyAccessContext(principal, location.companyId);

    if (context.unrestrictedLocations) {
      return location;
    }

    if (!context.allowedLocationIds.includes(location.id)) {
      throw new ForbiddenException("Location access denied.");
    }

    return location;
  }

  async requireShiftLocationAccess(
    principal: AuthenticatedPrincipal,
    shift: { companyId: string; locationId: string }
  ) {
    await this.getCompanyAccessContext(principal, shift.companyId);
    await this.assertLocationFilterAllowed(principal, shift.companyId, shift.locationId);
  }

  async requireGroupOwner(principal: AuthenticatedPrincipal, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    if (principal.globalRole === GlobalRole.PLATFORM_SUPERADMIN) {
      return company;
    }

    const groupOwnerMembership = await this.prisma.groupMembership.findFirst({
      where: {
        groupId: company.groupId,
        userId: principal.userId,
        role: GroupRole.GROUP_OWNER,
        status: MembershipStatus.ACTIVE
      },
      select: { id: true }
    });

    if (!groupOwnerMembership) {
      throw new ForbiddenException("Group owner access is required for this action.");
    }

    return company;
  }

  private async loadSupervisorLocationIds(supervisorUserId: string, companyId: string) {
    const assignments = await this.prisma.supervisorLocationAssignment.findMany({
      where: {
        companyId,
        supervisorUserId,
        unassignedAt: null
      },
      select: { locationId: true },
      orderBy: { assignedAt: "asc" }
    });

    return assignments.map((assignment) => assignment.locationId);
  }

  private buildContext(
    company: {
      id: string;
      groupId: string;
      name: string;
      createdAt: Date;
      updatedAt: Date;
    },
    accessLevel: CompanyAccessLevel,
    allowedLocationIds: string[] | null
  ): CompanyAccessContext {
    const unrestrictedLocations = allowedLocationIds === null;
    const canManageCompany = accessLevel !== "supervisor";

    return {
      company,
      accessLevel,
      unrestrictedLocations,
      allowedLocationIds: allowedLocationIds ?? [],
      canManageCompany,
      canAccessWeeklyClose: canManageCompany,
      canAccessKioskAdmin: canManageCompany
    };
  }
}
