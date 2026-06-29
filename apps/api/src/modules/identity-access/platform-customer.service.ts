import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CompanyRole, GlobalRole, GroupRole, GroupStatus, MembershipStatus } from "@prisma/client";

import type { AuthenticatedPrincipal } from "./auth.types";
import { GroupAccessService } from "./group-access.service";
import { PasswordService } from "./password.service";
import { PrismaService } from "./prisma.service";

const MIN_OWNER_PASSWORD_LENGTH = 8;

export type PlatformCustomerListRecord = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  companyCount: number;
  primaryCompany: {
    id: string;
    name: string;
  } | null;
  owner: {
    email: string;
    fullName: string | null;
  } | null;
  lifecycleStatus: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  ownerStatus: "Active" | "Invited" | "Pending";
  suspendedAt: Date | null;
  suspendedReason: string | null;
  archivedAt: Date | null;
  archivedReason: string | null;
};

export type PlatformCustomerCompanyRecord = {
  id: string;
  name: string;
  groupId: string;
  createdAt: Date;
  lifecycleStatus: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  initialAdmin: {
    email: string;
    fullName: string | null;
    status: "Active" | "Invited" | "Pending";
  } | null;
};

export type CreatePlatformCustomerInput = {
  customerName: string;
  companyName: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
};

@Injectable()
export class PlatformCustomerService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(GroupAccessService) private readonly groupAccessService: GroupAccessService
  ) {}

  async listCustomers(): Promise<PlatformCustomerListRecord[]> {
    const groups = await this.prisma.group.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        companies: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            id: true,
            name: true
          }
        },
        memberships: {
          where: {
            role: GroupRole.GROUP_OWNER
          },
          orderBy: { createdAt: "asc" },
          take: 1,
          include: {
            user: {
              select: {
                email: true,
                fullName: true
              }
            }
          }
        },
        _count: {
          select: {
            companies: true
          }
        }
      }
    });

    return groups.map((group) => this.toListRecord(group));
  }

  async getCustomer(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        companies: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            createdAt: true
          }
        },
        memberships: {
          where: {
            role: GroupRole.GROUP_OWNER
          },
          orderBy: { createdAt: "asc" },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true
              }
            }
          }
        },
        _count: {
          select: {
            companies: true
          }
        }
      }
    });

    if (!group) {
      throw new NotFoundException("Customer account not found.");
    }

    const listRecord = this.toListRecord(group);

    return {
      ...listRecord,
      companies: group.companies
    };
  }

  async listCustomerCompanies(groupId: string): Promise<PlatformCustomerCompanyRecord[]> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        status: true,
        companies: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            groupId: true,
            createdAt: true,
            memberships: {
              where: {
                role: CompanyRole.COMPANY_ADMIN
              },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: {
                email: true,
                status: true,
                user: {
                  select: {
                    email: true,
                    fullName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!group) {
      throw new NotFoundException("Customer account not found.");
    }

    return group.companies.map((company) => {
      const adminMembership = company.memberships[0] ?? null;
      const adminUser = adminMembership?.user ?? null;

      let adminStatus: "Active" | "Invited" | "Pending" = "Pending";

      if (adminMembership?.status === MembershipStatus.ACTIVE) {
        adminStatus = "Active";
      } else if (adminMembership?.status === MembershipStatus.INVITED) {
        adminStatus = "Invited";
      }

      return {
        id: company.id,
        name: company.name,
        groupId: company.groupId,
        createdAt: company.createdAt,
        lifecycleStatus: group.status,
        initialAdmin: adminMembership
          ? {
              email: adminUser?.email ?? adminMembership.email,
              fullName: adminUser?.fullName ?? null,
              status: adminStatus
            }
          : null
      };
    });
  }

  async createCustomer(principal: AuthenticatedPrincipal, input: CreatePlatformCustomerInput) {
    const customerName = input.customerName.trim();
    const companyName = input.companyName.trim();
    const ownerFullName = input.ownerFullName.trim();
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    const ownerPassword = input.ownerPassword;

    if (!customerName || !companyName || !ownerFullName || !ownerEmail || !ownerPassword) {
      throw new BadRequestException(
        "Customer name, company name, owner name, owner email, and temporary password are required."
      );
    }

    if (ownerPassword.length < MIN_OWNER_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Temporary password must be at least ${MIN_OWNER_PASSWORD_LENGTH} characters.`
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true }
    });

    if (existingUser) {
      throw new ConflictException("A user with this owner email already exists.");
    }

    const passwordHash = await this.passwordService.hashPassword(ownerPassword);

    const created = await this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: customerName
        }
      });

      const company = await tx.company.create({
        data: {
          groupId: group.id,
          name: companyName
        }
      });

      const owner = await tx.user.create({
        data: {
          email: ownerEmail,
          passwordHash,
          fullName: ownerFullName,
          globalRole: GlobalRole.NONE
        }
      });

      await tx.groupMembership.create({
        data: {
          groupId: group.id,
          userId: owner.id,
          email: ownerEmail,
          role: GroupRole.GROUP_OWNER,
          status: MembershipStatus.ACTIVE
        }
      });

      await tx.companyMembership.create({
        data: {
          companyId: company.id,
          userId: owner.id,
          email: ownerEmail,
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.ACTIVE
        }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          action: "PLATFORM_CUSTOMER_CREATED",
          targetType: "Group",
          targetId: group.id,
          groupId: group.id,
          companyId: company.id,
          metadata: {
            customerName,
            companyName,
            ownerEmail
          }
        }
      });

      return { group, company, owner };
    });

    return {
      customer: {
        id: created.group.id,
        name: created.group.name,
        createdAt: created.group.createdAt
      },
      company: {
        id: created.company.id,
        name: created.company.name,
        groupId: created.company.groupId
      },
      owner: {
        id: created.owner.id,
        email: created.owner.email,
        fullName: created.owner.fullName
      },
      temporaryPassword: ownerPassword
    };
  }

  async suspendCustomer(
    principal: AuthenticatedPrincipal,
    groupId: string,
    reason: string
  ) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      throw new BadRequestException("Suspension reason is required.");
    }

    const group = await this.requireGroup(groupId);

    if (group.status !== GroupStatus.ACTIVE) {
      throw new BadRequestException("Only active customers can be suspended.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.group.update({
        where: { id: groupId },
        data: {
          status: GroupStatus.SUSPENDED,
          suspendedAt: new Date(),
          suspendedByUserId: principal.userId,
          suspendedReason: normalizedReason
        }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          action: "PLATFORM_CUSTOMER_SUSPENDED",
          targetType: "Group",
          targetId: groupId,
          groupId,
          metadata: {
            reason: normalizedReason
          }
        }
      });

      return next;
    });

    await this.groupAccessService.revokeTenantSessionsForGroup(groupId);

    return this.getCustomer(updated.id);
  }

  async reactivateCustomer(principal: AuthenticatedPrincipal, groupId: string) {
    const group = await this.requireGroup(groupId);

    if (group.status !== GroupStatus.SUSPENDED) {
      throw new BadRequestException("Only suspended customers can be reactivated.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id: groupId },
        data: {
          status: GroupStatus.ACTIVE,
          suspendedAt: null,
          suspendedByUserId: null,
          suspendedReason: null
        }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          action: "PLATFORM_CUSTOMER_REACTIVATED",
          targetType: "Group",
          targetId: groupId,
          groupId,
          metadata: {}
        }
      });
    });

    return this.getCustomer(groupId);
  }

  async archiveCustomer(
    principal: AuthenticatedPrincipal,
    groupId: string,
    reason: string
  ) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      throw new BadRequestException("Archive reason is required.");
    }

    const group = await this.requireGroup(groupId);

    if (group.status === GroupStatus.ARCHIVED) {
      throw new BadRequestException("Customer is already archived.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id: groupId },
        data: {
          status: GroupStatus.ARCHIVED,
          archivedAt: new Date(),
          archivedByUserId: principal.userId,
          archivedReason: normalizedReason
        }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          action: "PLATFORM_CUSTOMER_ARCHIVED",
          targetType: "Group",
          targetId: groupId,
          groupId,
          metadata: {
            reason: normalizedReason
          }
        }
      });
    });

    await this.groupAccessService.revokeTenantSessionsForGroup(groupId);

    return this.getCustomer(groupId);
  }

  private async requireGroup(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      throw new NotFoundException("Customer account not found.");
    }

    return group;
  }

  private toListRecord(group: {
    id: string;
    name: string;
    status: GroupStatus;
    suspendedAt: Date | null;
    suspendedReason: string | null;
    archivedAt: Date | null;
    archivedReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    companies: Array<{ id: string; name: string }>;
    memberships: Array<{
      email: string;
      status: MembershipStatus;
      user: { email: string; fullName: string | null } | null;
    }>;
    _count: { companies: number };
  }): PlatformCustomerListRecord {
    const ownerMembership = group.memberships[0] ?? null;
    const ownerUser = ownerMembership?.user ?? null;

    let ownerStatus: PlatformCustomerListRecord["ownerStatus"] = "Pending";

    if (ownerMembership?.status === MembershipStatus.ACTIVE) {
      ownerStatus = "Active";
    } else if (ownerMembership?.status === MembershipStatus.INVITED) {
      ownerStatus = "Invited";
    }

    return {
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      companyCount: group._count.companies,
      primaryCompany: group.companies[0] ?? null,
      owner: ownerMembership
        ? {
            email: ownerUser?.email ?? ownerMembership.email,
            fullName: ownerUser?.fullName ?? null
          }
        : null,
      lifecycleStatus: group.status,
      ownerStatus,
      suspendedAt: group.suspendedAt,
      suspendedReason: group.suspendedReason,
      archivedAt: group.archivedAt,
      archivedReason: group.archivedReason
    };
  }
}
