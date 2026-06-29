import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";

import { CurrentPrincipal } from "./current-principal.decorator";
import { SuperadminGuard } from "./superadmin.guard";
import type { AuthenticatedPrincipal } from "./auth.types";
import { PlatformCustomerService } from "./platform-customer.service";

type CreatePlatformCustomerBody = {
  customerName: string;
  companyName: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
};

type LifecycleReasonBody = {
  reason?: string;
};

@Controller("platform/customers")
@UseGuards(SuperadminGuard)
export class PlatformCustomersController {
  constructor(
    @Inject(PlatformCustomerService)
    private readonly platformCustomerService: PlatformCustomerService
  ) {}

  @Get()
  listCustomers() {
    return this.platformCustomerService.listCustomers();
  }

  @Get(":groupId/companies")
  listCustomerCompanies(@Param("groupId") groupId: string) {
    return this.platformCustomerService.listCustomerCompanies(groupId);
  }

  @Get(":groupId")
  getCustomer(@Param("groupId") groupId: string) {
    return this.platformCustomerService.getCustomer(groupId);
  }

  @Post()
  createCustomer(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: CreatePlatformCustomerBody
  ) {
    return this.platformCustomerService.createCustomer(principal, {
      customerName: body.customerName,
      companyName: body.companyName,
      ownerFullName: body.ownerFullName,
      ownerEmail: body.ownerEmail,
      ownerPassword: body.ownerPassword
    });
  }

  @Post(":groupId/suspend")
  @HttpCode(200)
  suspendCustomer(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("groupId") groupId: string,
    @Body() body: LifecycleReasonBody
  ) {
    return this.platformCustomerService.suspendCustomer(principal, groupId, body.reason ?? "");
  }

  @Post(":groupId/reactivate")
  @HttpCode(200)
  reactivateCustomer(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("groupId") groupId: string
  ) {
    return this.platformCustomerService.reactivateCustomer(principal, groupId);
  }

  @Post(":groupId/archive")
  @HttpCode(200)
  archiveCustomer(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("groupId") groupId: string,
    @Body() body: LifecycleReasonBody
  ) {
    return this.platformCustomerService.archiveCustomer(principal, groupId, body.reason ?? "");
  }
}
