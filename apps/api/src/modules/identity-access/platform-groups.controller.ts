import { Body, Controller, Inject, Param, Post, UseGuards } from "@nestjs/common";

import { CurrentPrincipal } from "./current-principal.decorator";
import { SuperadminGuard } from "./superadmin.guard";
import type { AuthenticatedPrincipal } from "./auth.types";
import { AuthenticatedGuard } from "./authenticated.guard";
import { PlatformGroupService } from "./platform-group.service";

type CreateGroupBody = {
  name: string;
  ownerEmail: string;
};

type CreateCompanyBody = {
  name: string;
  adminEmail: string;
  adminFullName?: string;
};

@Controller()
export class PlatformGroupsController {
  constructor(
    @Inject(PlatformGroupService)
    private readonly platformGroupService: PlatformGroupService
  ) {}

  @Post("platform/groups")
  @UseGuards(SuperadminGuard)
  createGroup(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: CreateGroupBody
  ) {
    return this.platformGroupService.createGroupWithOwnerInvitation(principal, {
      name: body.name,
      ownerEmail: body.ownerEmail
    });
  }

  @Post("groups/:groupId/companies")
  @UseGuards(AuthenticatedGuard)
  createCompany(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("groupId") groupId: string,
    @Body() body: CreateCompanyBody
  ) {
    return this.platformGroupService.createCompanyWithAdminInvitation(principal, {
      groupId,
      companyName: body.name,
      adminEmail: body.adminEmail,
      adminFullName: body.adminFullName
    });
  }
}
