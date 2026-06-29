import { Inject, Injectable } from "@nestjs/common";
import { GroupStatus } from "@prisma/client";

import { assertTenantAccessibleGroupStatus } from "./group-access";
import { PrismaService } from "./prisma.service";

@Injectable()
export class GroupAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getGroupStatus(groupId: string): Promise<GroupStatus | null> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { status: true }
    });

    return group?.status ?? null;
  }

  async assertTenantGroupOperational(groupId: string): Promise<void> {
    const status = await this.getGroupStatus(groupId);

    if (!status) {
      return;
    }

    assertTenantAccessibleGroupStatus(status);
  }

  async assertCompanyTenantOperational(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { groupId: true }
    });

    if (!company) {
      return;
    }

    await this.assertTenantGroupOperational(company.groupId);
  }

  async revokeTenantSessionsForGroup(groupId: string): Promise<number> {
    const companies = await this.prisma.company.findMany({
      where: { groupId },
      select: { id: true }
    });
    const companyIds = companies.map((company) => company.id);

    const memberships = await this.prisma.user.findMany({
      where: {
        OR: [
          {
            groupMemberships: {
              some: { groupId }
            }
          },
          {
            companyMemberships: {
              some: {
                companyId: { in: companyIds }
              }
            }
          }
        ]
      },
      select: { id: true }
    });

    const userIds = memberships.map((user) => user.id);

    if (userIds.length === 0) {
      return 0;
    }

    const result = await this.prisma.session.updateMany({
      where: {
        userId: { in: userIds },
        revokedAt: null
      },
      data: {
        revokedAt: new Date(),
        activeCompanyId: null
      }
    });

    return result.count;
  }
}
