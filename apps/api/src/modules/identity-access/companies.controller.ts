import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";

import { CurrentPrincipal } from "./current-principal.decorator";
import { AuthenticatedGuard } from "./authenticated.guard";
import type { AuthenticatedPrincipal } from "./auth.types";
import { CompanyAccessService } from "./company-access.service";

@Controller("companies")
@UseGuards(AuthenticatedGuard)
export class CompaniesController {
  constructor(
    @Inject(CompanyAccessService)
    private readonly companyAccessService: CompanyAccessService
  ) {}

  @Get()
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.companyAccessService.listAccessibleCompanies(principal);
  }

  @Get(":companyId")
  getById(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string
  ) {
    return this.companyAccessService.getCompany(principal, companyId);
  }
}
