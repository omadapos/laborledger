import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CompanyRole, GlobalRole, GroupRole, GroupStatus, MembershipStatus } from "@prisma/client";

import type { AuthenticatedPrincipal } from "./auth.types";
import { assertTenantAccessibleGroupStatus } from "./group-access";
import { PrismaService } from "./prisma.service";

export type CompanyAccessRole =
  | "PLATFORM_SUPERADMIN"
  | "GROUP_OWNER"
  | "COMPANY_ADMIN"
  | "SUPERVISOR";

export type AccessibleCompanyRecord = {
  id: string;
  groupId: string;
  name: string;
  currencyCode: string;
  createdAt: Date;
  updatedAt: Date;
  accessRole: CompanyAccessRole;
  accessLabel: string;
};

export function formatCompanyAccessLabel(role: CompanyAccessRole): string {
  if (role === "PLATFORM_SUPERADMIN") {
    return "Platform superadmin";
  }

  if (role === "GROUP_OWNER") {
    return "Group owner";
  }

  if (role === "COMPANY_ADMIN") {
    return "Company admin";
  }

  return "Supervisor";
}

@Injectable()
export class CompanyAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async buildPrincipalForUser(userId: string): Promise<AuthenticatedPrincipal> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      include: {
        groupMemberships: {
          where: {
            status: MembershipStatus.ACTIVE,
            role: GroupRole.GROUP_OWNER
          }
        },
        companyMemberships: {
          where: {
            status: MembershipStatus.ACTIVE,
            role: {
              in: [CompanyRole.COMPANY_ADMIN, CompanyRole.SUPERVISOR]
            }
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    return {
      userId: user.id,
      email: user.email,
      globalRole: user.globalRole,
      groupOwnerGroupIds: user.groupMemberships.map((membership) => membership.groupId),
      companyAdminCompanyIds: user.companyMemberships
        .filter((membership) => membership.role === CompanyRole.COMPANY_ADMIN)
        .map((membership) => membership.companyId),
      supervisorCompanyIds: user.companyMemberships
        .filter((membership) => membership.role === CompanyRole.SUPERVISOR)
        .map((membership) => membership.companyId),
      sessionId: "",
      activeCompanyId: null
    };
  }

  async listAccessibleCompanies(principal: AuthenticatedPrincipal) {
    if (principal.globalRole === GlobalRole.PLATFORM_SUPERADMIN) {
      return this.prisma.company.findMany({
        orderBy: { createdAt: "asc" }
      });
    }

    return this.prisma.company.findMany({
      where: {
        AND: [
          {
            group: {
              status: GroupStatus.ACTIVE
            }
          },
          {
            OR: [
              {
                group: {
                  memberships: {
                    some: {
                      userId: principal.userId,
                      role: GroupRole.GROUP_OWNER,
                      status: MembershipStatus.ACTIVE
                    }
                  }
                }
              },
              {
                memberships: {
                  some: {
                    userId: principal.userId,
                    role: {
                      in: [CompanyRole.COMPANY_ADMIN, CompanyRole.SUPERVISOR]
                    },
                    status: MembershipStatus.ACTIVE
                  }
                }
              }
            ]
          }
        ]
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async resolveAccessRole(
    principal: AuthenticatedPrincipal,
    company: { id: string; groupId: string }
  ): Promise<CompanyAccessRole | null> {
    if (principal.globalRole === GlobalRole.PLATFORM_SUPERADMIN) {
      return "PLATFORM_SUPERADMIN";
    }

    if (principal.groupOwnerGroupIds.includes(company.groupId)) {
      return "GROUP_OWNER";
    }

    if (principal.companyAdminCompanyIds.includes(company.id)) {
      return "COMPANY_ADMIN";
    }

    if (principal.supervisorCompanyIds.includes(company.id)) {
      return "SUPERVISOR";
    }

    return null;
  }

  async listAccessibleCompaniesWithAccess(
    principal: AuthenticatedPrincipal
  ): Promise<AccessibleCompanyRecord[]> {
    const companies = await this.listAccessibleCompanies(principal);

    return companies.flatMap((company) => {
      const accessRole = this.resolveAccessRoleSync(principal, company);

      if (!accessRole) {
        return [];
      }

      return [
        {
          ...company,
          accessRole,
          accessLabel: formatCompanyAccessLabel(accessRole)
        }
      ];
    });
  }

  resolveAccessRoleSync(
    principal: AuthenticatedPrincipal,
    company: { id: string; groupId: string }
  ): CompanyAccessRole | null {
    if (principal.globalRole === GlobalRole.PLATFORM_SUPERADMIN) {
      return "PLATFORM_SUPERADMIN";
    }

    if (principal.groupOwnerGroupIds.includes(company.groupId)) {
      return "GROUP_OWNER";
    }

    if (principal.companyAdminCompanyIds.includes(company.id)) {
      return "COMPANY_ADMIN";
    }

    if (principal.supervisorCompanyIds.includes(company.id)) {
      return "SUPERVISOR";
    }

    return null;
  }

  async getCompany(principal: AuthenticatedPrincipal, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: {
        id: companyId
      }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    const accessRole = this.resolveAccessRoleSync(principal, company);

    if (!accessRole) {
      throw new ForbiddenException("Access denied for this company.");
    }

    if (principal.globalRole !== GlobalRole.PLATFORM_SUPERADMIN) {
      const group = await this.prisma.group.findUnique({
        where: { id: company.groupId },
        select: { status: true }
      });

      if (group) {
        assertTenantAccessibleGroupStatus(group.status);
      }
    }

    return company;
  }

  async assertCanAccessCompany(principal: AuthenticatedPrincipal, companyId: string) {
    await this.getCompany(principal, companyId);
  }
}
