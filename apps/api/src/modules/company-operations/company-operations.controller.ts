import { Body, Controller, Delete, Get, Header, Inject, Param, Patch, Post, Query, StreamableFile, UseGuards } from "@nestjs/common";

import { CurrentPrincipal } from "../identity-access/current-principal.decorator";
import { AuthenticatedGuard } from "../identity-access/authenticated.guard";
import type { AuthenticatedPrincipal } from "../identity-access/auth.types";

import { CompanyOperationsService } from "./company-operations.service";
import { KioskAdminService } from "./kiosk-admin.service";
import { ShiftReviewService } from "../shift-review/shift-review.service";
import { CorrectionsService } from "../corrections/corrections.service";
import { WeeklyCloseService } from "../weekly-close/weekly-close.service";
import { ClientInvoiceDeliveryService } from "../client-invoice-delivery/client-invoice-delivery.service";
import { ClientInvoicePdfService } from "../client-invoice-pdf/client-invoice-pdf.service";
import { OperationsReportsService } from "../operations-reports/operations-reports.service";
import { LaborPayBillingService } from "../labor-pay-billing/labor-pay-billing.service";
import { LaborWorkAssignmentService } from "../labor-work-assignment/labor-work-assignment.service";
import { LaborWorkAssignmentStatus } from "@prisma/client";

type CreateServiceClientBody = { name: string };
type UpdateServiceClientBody = { name: string };

type CreateLocationBody = {
  serviceClientId: string;
  name: string;
  timezone: string;
};

type UpdateLocationBody = {
  serviceClientId: string;
  name: string;
  timezone: string;
};

type CreateEmployeeBody = {
  fullName: string;
  pin: string;
};

type UpdateEmployeeBody = {
  fullName: string;
};

type RegeneratePinBody = {
  pin: string;
};

type CreateShiftBody = {
  employeeId: string;
  serviceClientId: string;
  locationId: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
};

type UpdateShiftBody = {
  employeeId?: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
};

type CancelShiftBody = {
  cancelReason: string;
};

type CopyWeekBody = {
  sourceWeekStart: string;
  targetWeekStart: string;
  locationId?: string;
  employeeId?: string;
  serviceClientId?: string;
};

type EffectiveRateBody = {
  rateMinorUnits: number;
  effectiveStart: string;
  effectiveEnd?: string;
};

type CreateServiceCatalogItemBody = {
  name: string;
  description?: string;
  category?: string;
  fixedPriceMinor: number;
  currencyCode?: string;
};

type UpdateServiceCatalogItemBody = {
  name: string;
  description?: string | null;
  category?: string | null;
  fixedPriceMinor: number;
  currencyCode?: string;
};

type CreateVehicleBody = {
  vin: string;
  serviceClientId: string;
  locationId: string;
  plate?: string;
  color?: string;
  mileage?: number;
  notes?: string;
};

type UpdateVehicleBody = {
  serviceClientId: string;
  locationId: string;
  plate?: string | null;
  color?: string | null;
  mileage?: number | null;
  notes?: string | null;
};

type DecodeVinBody = {
  vin: string;
  modelYear?: number;
};

type CreateWorkOrderBody = {
  vehicleId: string;
  serviceCatalogItemIds: string[];
  notes?: string;
  status?: "DRAFT" | "READY";
};

type UpdateWorkOrderBody = {
  notes?: string | null;
  status?: "DRAFT" | "READY";
};

type CancelWorkOrderBody = {
  cancelReason: string;
};

type AssignWorkOrderEmployeeBody = {
  employeeId: string;
  workOrderServiceLineId?: string;
  roleLabel?: string;
};

type UnassignWorkOrderAssignmentBody = {
  unassignReason?: string;
};

type CreateClientInvoiceBody = {
  serviceClientId: string;
  workOrderIds: string[];
  notes?: string;
};

type VoidClientInvoiceBody = {
  voidReason: string;
};

type SendClientInvoiceEmailBody = {
  recipientEmail?: string;
  message?: string;
};

type AssignSupervisorBody = {
  supervisorUserId: string;
};

type AssignSupervisorLocationBody = {
  locationId: string;
};

type UpdateCompanyProfileBody = {
  legalName?: string | null;
  phone?: string | null;
  billingEmail?: string | null;
  primaryContactName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

type CreateCorrectionBody = {
  type: string;
  reason: string;
  proposedEventUtc: string;
  punchEventId?: string;
  proposedBreakMinutes?: number;
};

type RejectCorrectionBody = {
  reviewReason: string;
};

type ApproveCorrectionBody = {
  reviewReason?: string;
};

type CloseWeeklyBody = {
  weekStart: string;
  closeNote?: string;
};

type ReopenWeeklyBody = {
  reason: string;
};

type CreateKioskBody = {
  name: string;
  locationId: string;
};

type UpdateKioskBody = {
  name: string;
};

type PatchLaborWorkAssignmentBody = {
  notes?: string;
  status?: LaborWorkAssignmentStatus;
};

@Controller("company-operations")
@UseGuards(AuthenticatedGuard)
export class CompanyOperationsController {
  constructor(
    @Inject(CompanyOperationsService)
    private readonly companyOperationsService: CompanyOperationsService,
    @Inject(KioskAdminService)
    private readonly kioskAdminService: KioskAdminService,
    @Inject(ShiftReviewService)
    private readonly shiftReviewService: ShiftReviewService,
    @Inject(CorrectionsService)
    private readonly correctionsService: CorrectionsService,
    @Inject(WeeklyCloseService)
    private readonly weeklyCloseService: WeeklyCloseService,
    @Inject(ClientInvoiceDeliveryService)
    private readonly clientInvoiceDeliveryService: ClientInvoiceDeliveryService,
    @Inject(ClientInvoicePdfService)
    private readonly clientInvoicePdfService: ClientInvoicePdfService,
    @Inject(OperationsReportsService)
    private readonly operationsReportsService: OperationsReportsService,
    @Inject(LaborPayBillingService)
    private readonly laborPayBillingService: LaborPayBillingService,
    @Inject(LaborWorkAssignmentService)
    private readonly laborWorkAssignmentService: LaborWorkAssignmentService
  ) {}

  @Post("companies/:companyId/service-clients")
  createServiceClient(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CreateServiceClientBody
  ) {
    return this.companyOperationsService.createServiceClient(principal, companyId, body);
  }

  @Get("companies/:companyId/service-clients")
  listServiceClients(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("includeArchived") includeArchived?: string
  ) {
    return this.companyOperationsService.listServiceClients(principal, companyId, {
      includeArchived: includeArchived === "true"
    });
  }

  @Post("service-clients/:serviceClientId")
  updateServiceClient(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("serviceClientId") serviceClientId: string,
    @Body() body: UpdateServiceClientBody
  ) {
    return this.companyOperationsService.updateServiceClient(principal, serviceClientId, body);
  }

  @Post("service-clients/:serviceClientId/archive")
  archiveServiceClient(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("serviceClientId") serviceClientId: string
  ) {
    return this.companyOperationsService.archiveServiceClient(principal, serviceClientId);
  }

  @Post("service-clients/:serviceClientId/unarchive")
  unarchiveServiceClient(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("serviceClientId") serviceClientId: string
  ) {
    return this.companyOperationsService.unarchiveServiceClient(principal, serviceClientId);
  }

  @Post("service-clients/:serviceClientId/rates")
  addServiceClientRate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("serviceClientId") serviceClientId: string,
    @Body() body: EffectiveRateBody
  ) {
    return this.companyOperationsService.addServiceClientRate(principal, serviceClientId, body);
  }

  @Get("service-clients/:serviceClientId/rates")
  listServiceClientRates(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("serviceClientId") serviceClientId: string
  ) {
    return this.companyOperationsService.listServiceClientRates(principal, serviceClientId);
  }

  @Post("companies/:companyId/service-catalog")
  createServiceCatalogItem(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CreateServiceCatalogItemBody
  ) {
    return this.companyOperationsService.createServiceCatalogItem(principal, companyId, body);
  }

  @Get("companies/:companyId/service-catalog")
  listServiceCatalogItems(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("includeArchived") includeArchived?: string
  ) {
    return this.companyOperationsService.listServiceCatalogItems(principal, companyId, {
      includeArchived: includeArchived === "true"
    });
  }

  @Get("service-catalog/:serviceCatalogItemId")
  getServiceCatalogItem(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("serviceCatalogItemId") serviceCatalogItemId: string
  ) {
    return this.companyOperationsService.getServiceCatalogItem(principal, serviceCatalogItemId);
  }

  @Post("service-catalog/:serviceCatalogItemId")
  updateServiceCatalogItem(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("serviceCatalogItemId") serviceCatalogItemId: string,
    @Body() body: UpdateServiceCatalogItemBody
  ) {
    return this.companyOperationsService.updateServiceCatalogItem(principal, serviceCatalogItemId, body);
  }

  @Post("service-catalog/:serviceCatalogItemId/archive")
  archiveServiceCatalogItem(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("serviceCatalogItemId") serviceCatalogItemId: string
  ) {
    return this.companyOperationsService.archiveServiceCatalogItem(principal, serviceCatalogItemId);
  }

  @Post("service-catalog/:serviceCatalogItemId/unarchive")
  unarchiveServiceCatalogItem(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("serviceCatalogItemId") serviceCatalogItemId: string
  ) {
    return this.companyOperationsService.unarchiveServiceCatalogItem(principal, serviceCatalogItemId);
  }

  @Post("companies/:companyId/vehicles")
  createVehicle(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CreateVehicleBody
  ) {
    return this.companyOperationsService.createVehicle(principal, companyId, body);
  }

  @Get("companies/:companyId/vehicles")
  listVehicles(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("includeArchived") includeArchived?: string,
    @Query("serviceClientId") serviceClientId?: string,
    @Query("locationId") locationId?: string,
    @Query("q") q?: string
  ) {
    return this.companyOperationsService.listVehicles(principal, companyId, {
      includeArchived: includeArchived === "true",
      serviceClientId,
      locationId,
      q
    });
  }

  @Get("vehicles/:vehicleId")
  getVehicle(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("vehicleId") vehicleId: string
  ) {
    return this.companyOperationsService.getVehicle(principal, vehicleId);
  }

  @Post("vehicles/decode-vin")
  decodeVehicleVin(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: DecodeVinBody
  ) {
    return this.companyOperationsService.previewVehicleVinDecode(principal, body);
  }

  @Post("vehicles/:vehicleId")
  updateVehicle(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("vehicleId") vehicleId: string,
    @Body() body: UpdateVehicleBody
  ) {
    return this.companyOperationsService.updateVehicle(principal, vehicleId, body);
  }

  @Post("vehicles/:vehicleId/archive")
  archiveVehicle(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("vehicleId") vehicleId: string
  ) {
    return this.companyOperationsService.archiveVehicle(principal, vehicleId);
  }

  @Post("vehicles/:vehicleId/unarchive")
  unarchiveVehicle(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("vehicleId") vehicleId: string
  ) {
    return this.companyOperationsService.unarchiveVehicle(principal, vehicleId);
  }

  @Post("companies/:companyId/work-orders")
  createWorkOrder(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CreateWorkOrderBody
  ) {
    return this.companyOperationsService.createWorkOrder(principal, companyId, body);
  }

  @Get("companies/:companyId/work-orders")
  listWorkOrders(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("serviceClientId") serviceClientId?: string,
    @Query("locationId") locationId?: string,
    @Query("status") status?: "DRAFT" | "READY" | "ASSIGNED" | "CANCELLED",
    @Query("q") q?: string
  ) {
    return this.companyOperationsService.listWorkOrders(principal, companyId, {
      serviceClientId,
      locationId,
      ...(status ? { status } : {}),
      q
    });
  }

  @Get("work-orders/:workOrderId")
  getWorkOrder(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("workOrderId") workOrderId: string
  ) {
    return this.companyOperationsService.getWorkOrder(principal, workOrderId);
  }

  @Post("work-orders/:workOrderId")
  updateWorkOrder(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("workOrderId") workOrderId: string,
    @Body() body: UpdateWorkOrderBody
  ) {
    return this.companyOperationsService.updateWorkOrder(principal, workOrderId, body);
  }

  @Post("work-orders/:workOrderId/cancel")
  cancelWorkOrder(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("workOrderId") workOrderId: string,
    @Body() body: CancelWorkOrderBody
  ) {
    return this.companyOperationsService.cancelWorkOrder(principal, workOrderId, body);
  }

  @Post("work-orders/:workOrderId/assignments")
  assignWorkOrderEmployee(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("workOrderId") workOrderId: string,
    @Body() body: AssignWorkOrderEmployeeBody
  ) {
    return this.companyOperationsService.assignWorkOrderEmployee(principal, workOrderId, body);
  }

  @Post("work-order-assignments/:assignmentId/unassign")
  unassignWorkOrderAssignment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("assignmentId") assignmentId: string,
    @Body() body: UnassignWorkOrderAssignmentBody
  ) {
    return this.companyOperationsService.unassignWorkOrderAssignment(principal, assignmentId, body);
  }

  @Get("companies/:companyId/client-invoices")
  listClientInvoices(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("serviceClientId") serviceClientId?: string,
    @Query("status") status?: "DRAFT" | "ISSUED" | "VOID",
    @Query("q") q?: string
  ) {
    return this.companyOperationsService.listClientInvoices(principal, companyId, {
      serviceClientId,
      ...(status ? { status } : {}),
      q
    });
  }

  @Post("companies/:companyId/client-invoices")
  createClientInvoice(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CreateClientInvoiceBody
  ) {
    return this.companyOperationsService.createClientInvoice(principal, companyId, body);
  }

  @Get("companies/:companyId/invoiceable-work-orders")
  listInvoiceableWorkOrders(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("serviceClientId") serviceClientId: string
  ) {
    return this.companyOperationsService.listInvoiceableWorkOrders(
      principal,
      companyId,
      serviceClientId
    );
  }

  @Get("client-invoices/:clientInvoiceId")
  getClientInvoice(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("clientInvoiceId") clientInvoiceId: string
  ) {
    return this.companyOperationsService.getClientInvoice(principal, clientInvoiceId);
  }

  @Post("client-invoices/:clientInvoiceId/issue")
  issueClientInvoice(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("clientInvoiceId") clientInvoiceId: string
  ) {
    return this.companyOperationsService.issueClientInvoice(principal, clientInvoiceId);
  }

  @Post("client-invoices/:clientInvoiceId/void")
  voidClientInvoice(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("clientInvoiceId") clientInvoiceId: string,
    @Body() body: VoidClientInvoiceBody
  ) {
    return this.companyOperationsService.voidClientInvoice(principal, clientInvoiceId, body);
  }

  @Get("client-invoices/:clientInvoiceId/deliveries")
  listClientInvoiceDeliveries(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("clientInvoiceId") clientInvoiceId: string
  ) {
    return this.clientInvoiceDeliveryService.listDeliveries(principal, clientInvoiceId);
  }

  @Get("client-invoices/:clientInvoiceId/pdf")
  @Header("Content-Type", "application/pdf")
  async getClientInvoicePdf(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("clientInvoiceId") clientInvoiceId: string
  ) {
    const pdf = await this.clientInvoicePdfService.generateClientInvoicePdf(principal, clientInvoiceId);

    return new StreamableFile(pdf.buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${pdf.filename}"`
    });
  }

  @Post("client-invoices/:clientInvoiceId/send-email")
  sendClientInvoiceByEmail(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("clientInvoiceId") clientInvoiceId: string,
    @Body() body: SendClientInvoiceEmailBody
  ) {
    return this.clientInvoiceDeliveryService.sendClientInvoiceByEmail(principal, clientInvoiceId, body);
  }

  @Post("companies/:companyId/locations")
  createLocation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CreateLocationBody
  ) {
    return this.companyOperationsService.createLocation(principal, companyId, body);
  }

  @Get("companies/:companyId/locations")
  listLocations(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("includeArchived") includeArchived?: string
  ) {
    return this.companyOperationsService.listLocations(principal, companyId, {
      includeArchived: includeArchived === "true"
    });
  }

  @Get("locations/:locationId")
  getLocation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("locationId") locationId: string
  ) {
    return this.companyOperationsService.getLocation(principal, locationId);
  }

  @Post("locations/:locationId")
  updateLocation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("locationId") locationId: string,
    @Body() body: UpdateLocationBody
  ) {
    return this.companyOperationsService.updateLocation(principal, locationId, body);
  }

  @Post("locations/:locationId/unarchive")
  unarchiveLocation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("locationId") locationId: string
  ) {
    return this.companyOperationsService.unarchiveLocation(principal, locationId);
  }

  @Post("locations/:locationId/archive")
  archiveLocation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("locationId") locationId: string
  ) {
    return this.companyOperationsService.archiveLocation(principal, locationId);
  }

  @Post("locations/:locationId/rates")
  addLocationRate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("locationId") locationId: string,
    @Body() body: EffectiveRateBody
  ) {
    return this.companyOperationsService.addLocationRate(principal, locationId, body);
  }

  @Get("locations/:locationId/rates")
  listLocationRates(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("locationId") locationId: string
  ) {
    return this.companyOperationsService.listLocationRates(principal, locationId);
  }

  @Post("companies/:companyId/employees")
  createEmployee(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CreateEmployeeBody
  ) {
    return this.companyOperationsService.createEmployee(principal, companyId, body);
  }

  @Get("companies/:companyId/employees")
  listEmployees(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("includeArchived") includeArchived?: string
  ) {
    return this.companyOperationsService.listEmployees(principal, companyId, {
      includeArchived: includeArchived === "true"
    });
  }

  @Get("employees/:employeeId")
  getEmployee(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("employeeId") employeeId: string
  ) {
    return this.companyOperationsService.getEmployee(principal, employeeId);
  }

  @Post("employees/:employeeId")
  updateEmployee(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("employeeId") employeeId: string,
    @Body() body: UpdateEmployeeBody
  ) {
    return this.companyOperationsService.updateEmployee(principal, employeeId, body);
  }

  @Post("employees/:employeeId/unarchive")
  unarchiveEmployee(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("employeeId") employeeId: string
  ) {
    return this.companyOperationsService.unarchiveEmployee(principal, employeeId);
  }

  @Post("employees/:employeeId/archive")
  archiveEmployee(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("employeeId") employeeId: string
  ) {
    return this.companyOperationsService.archiveEmployee(principal, employeeId);
  }

  @Post("employees/:employeeId/pin/regenerate")
  regenerateEmployeePin(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("employeeId") employeeId: string,
    @Body() body: RegeneratePinBody
  ) {
    return this.companyOperationsService.regenerateEmployeePin(principal, employeeId, body);
  }

  @Post("employees/:employeeId/rates")
  addEmployeeRate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("employeeId") employeeId: string,
    @Body() body: EffectiveRateBody
  ) {
    return this.companyOperationsService.addEmployeeRate(principal, employeeId, body);
  }

  @Get("employees/:employeeId/rates")
  listEmployeeRates(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("employeeId") employeeId: string
  ) {
    return this.companyOperationsService.listEmployeeRates(principal, employeeId);
  }

  @Post("locations/:locationId/supervisors")
  assignSupervisor(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("locationId") locationId: string,
    @Body() body: AssignSupervisorBody
  ) {
    return this.companyOperationsService.assignSupervisorToLocation(principal, locationId, body);
  }

  @Delete("supervisor-assignments/:assignmentId")
  unassignSupervisor(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("assignmentId") assignmentId: string
  ) {
    return this.companyOperationsService.unassignSupervisor(principal, assignmentId);
  }

  @Get("locations/:locationId/supervisors")
  listLocationSupervisors(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("locationId") locationId: string
  ) {
    return this.companyOperationsService.listLocationSupervisors(principal, locationId);
  }

  @Get("companies/:companyId/shifts")
  listShifts(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("locationId") locationId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("includeCancelled") includeCancelled?: string
  ) {
    return this.companyOperationsService.listShifts(principal, companyId, {
      from,
      to,
      locationId,
      employeeId,
      includeCancelled: includeCancelled === "true"
    });
  }

  @Post("companies/:companyId/shifts")
  createShift(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CreateShiftBody
  ) {
    return this.companyOperationsService.createShift(principal, companyId, body);
  }

  @Post("companies/:companyId/shifts/copy-week")
  copyWeekShifts(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CopyWeekBody
  ) {
    return this.companyOperationsService.copyWeekShifts(principal, companyId, body);
  }

  @Get("shifts/:shiftId")
  getShift(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("shiftId") shiftId: string
  ) {
    return this.companyOperationsService.getShift(principal, shiftId);
  }

  @Post("shifts/:shiftId")
  updateShift(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("shiftId") shiftId: string,
    @Body() body: UpdateShiftBody
  ) {
    return this.companyOperationsService.updateShift(principal, shiftId, body);
  }

  @Post("shifts/:shiftId/cancel")
  cancelShift(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("shiftId") shiftId: string,
    @Body() body: CancelShiftBody
  ) {
    return this.companyOperationsService.cancelShift(principal, shiftId, body);
  }

  @Get("companies/:companyId/review-shifts")
  listReviewShifts(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("locationId") locationId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("status") status?: "needs_review" | "approved" | "incomplete" | "exceptions"
  ) {
    return this.shiftReviewService.listReviewShifts(principal, companyId, {
      from,
      to,
      locationId,
      employeeId,
      status
    });
  }

  @Get("shifts/:shiftId/review")
  getReviewShift(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("shiftId") shiftId: string
  ) {
    return this.shiftReviewService.getReviewShift(principal, shiftId);
  }

  @Post("shifts/:shiftId/approve")
  approveShift(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("shiftId") shiftId: string
  ) {
    return this.shiftReviewService.approveShift(principal, shiftId);
  }

  @Post("shifts/:shiftId/approve-additional-time")
  approveAdditionalTime(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("shiftId") shiftId: string
  ) {
    return this.shiftReviewService.approveAdditionalTime(principal, shiftId);
  }

  @Get("companies/:companyId/corrections")
  listCorrections(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("locationId") locationId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("status") status?: string,
    @Query("type") type?: string
  ) {
    return this.correctionsService.listCorrections(principal, companyId, {
      from,
      to,
      locationId,
      employeeId,
      status: status as never,
      type: type as never
    });
  }

  @Post("shifts/:shiftId/corrections")
  createCorrection(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("shiftId") shiftId: string,
    @Body() body: CreateCorrectionBody
  ) {
    return this.correctionsService.createCorrection(principal, shiftId, {
      type: body.type as never,
      reason: body.reason,
      proposedEventUtc: body.proposedEventUtc,
      punchEventId: body.punchEventId,
      proposedBreakMinutes: body.proposedBreakMinutes
    });
  }

  @Get("corrections/:correctionId")
  getCorrection(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("correctionId") correctionId: string
  ) {
    return this.correctionsService.getCorrection(principal, correctionId);
  }

  @Post("corrections/:correctionId/approve")
  approveCorrection(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("correctionId") correctionId: string,
    @Body() body: ApproveCorrectionBody
  ) {
    return this.correctionsService.approveCorrection(principal, correctionId, body.reviewReason);
  }

  @Post("corrections/:correctionId/reject")
  rejectCorrection(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("correctionId") correctionId: string,
    @Body() body: RejectCorrectionBody
  ) {
    return this.correctionsService.rejectCorrection(principal, correctionId, body.reviewReason);
  }

  @Post("corrections/:correctionId/apply")
  applyCorrection(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("correctionId") correctionId: string
  ) {
    return this.correctionsService.applyCorrection(principal, correctionId);
  }

  @Get("companies/:companyId/weekly-close")
  getWeeklyCloseSummary(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("weekStart") weekStart?: string
  ) {
    return this.weeklyCloseService.getWeeklyCloseSummary(principal, companyId, weekStart);
  }

  @Get("companies/:companyId/reports/operations-summary")
  getOperationsSummary(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.operationsReportsService.getOperationsSummary(principal, companyId, { from, to });
  }

  @Get("companies/:companyId/labor-pay-billing/preview")
  getLaborPayBillingPreview(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("weekStart") weekStart?: string,
    @Query("serviceClientId") serviceClientId?: string,
    @Query("locationId") locationId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("onlyClosedWeeks") onlyClosedWeeks?: string
  ) {
    return this.laborPayBillingService.getPreview(principal, companyId, {
      weekStart,
      serviceClientId,
      locationId,
      employeeId,
      onlyClosedWeeks
    });
  }

  @Get("companies/:companyId/labor-pay-billing/payroll-csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="employee-pay-prep.csv"')
  async getLaborPayBillingPayrollCsv(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("weekStart") weekStart?: string,
    @Query("serviceClientId") serviceClientId?: string,
    @Query("locationId") locationId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("onlyClosedWeeks") onlyClosedWeeks?: string
  ) {
    const csv = await this.laborPayBillingService.getEmployeePayCsv(principal, companyId, {
      weekStart,
      serviceClientId,
      locationId,
      employeeId,
      onlyClosedWeeks
    });

    return new StreamableFile(Buffer.from(csv, "utf8"));
  }

  @Get("companies/:companyId/labor-pay-billing/client-billing-csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="client-labor-billing.csv"')
  async getLaborPayBillingClientCsv(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("weekStart") weekStart?: string,
    @Query("serviceClientId") serviceClientId?: string,
    @Query("locationId") locationId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("onlyClosedWeeks") onlyClosedWeeks?: string
  ) {
    const csv = await this.laborPayBillingService.getClientBillingCsv(principal, companyId, {
      weekStart,
      serviceClientId,
      locationId,
      employeeId,
      onlyClosedWeeks
    });

    return new StreamableFile(Buffer.from(csv, "utf8"));
  }

  @Post("companies/:companyId/labor-pay-billing/drafts")
  createLaborPayBillingDraft(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string
  ) {
    return this.laborPayBillingService.createDraft();
  }

  @Get("companies/:companyId/labor-work-assignments")
  listLaborWorkAssignments(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("locationId") locationId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("serviceClientId") serviceClientId?: string,
    @Query("status") status?: LaborWorkAssignmentStatus,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.laborWorkAssignmentService.listForAdmin(principal, companyId, {
      locationId,
      employeeId,
      serviceClientId,
      status,
      from,
      to
    });
  }

  @Get("companies/:companyId/labor-work-assignments/export-csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="labor-work-log.csv"')
  async exportLaborWorkAssignmentsCsv(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("locationId") locationId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("serviceClientId") serviceClientId?: string,
    @Query("status") status?: LaborWorkAssignmentStatus,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const csv = await this.laborWorkAssignmentService.exportCsvForAdmin(principal, companyId, {
      locationId,
      employeeId,
      serviceClientId,
      status,
      from,
      to
    });

    return new StreamableFile(Buffer.from(csv, "utf8"));
  }

  @Patch("companies/:companyId/labor-work-assignments/:id")
  patchLaborWorkAssignment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Param("id") id: string,
    @Body() body: PatchLaborWorkAssignmentBody
  ) {
    return this.laborWorkAssignmentService.patchForAdmin(principal, companyId, id, body);
  }

  @Post("companies/:companyId/weekly-close")
  closeWeeklyPeriod(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CloseWeeklyBody
  ) {
    return this.weeklyCloseService.closeWeeklyPeriod(principal, companyId, body);
  }

  @Post("weekly-periods/:weeklyPeriodId/reopen")
  reopenWeeklyPeriod(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("weeklyPeriodId") weeklyPeriodId: string,
    @Body() body: ReopenWeeklyBody
  ) {
    return this.weeklyCloseService.reopenWeeklyPeriod(principal, weeklyPeriodId, body);
  }

  @Get("companies/:companyId/access-context")
  getCompanyAccessContext(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string
  ) {
    return this.companyOperationsService.getCompanyAccessContext(principal, companyId);
  }

  @Get("companies/:companyId/profile")
  getCompanyProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string
  ) {
    return this.companyOperationsService.getCompanyProfile(principal, companyId);
  }

  @Patch("companies/:companyId/profile")
  updateCompanyProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: UpdateCompanyProfileBody
  ) {
    return this.companyOperationsService.updateCompanyProfile(principal, companyId, body);
  }

  @Get("companies/:companyId/supervisors")
  listCompanySupervisors(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string
  ) {
    return this.companyOperationsService.listCompanySupervisors(principal, companyId);
  }

  @Get("companies/:companyId/supervisor-location-assignments")
  listCompanySupervisorLocationAssignments(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string
  ) {
    return this.companyOperationsService.listCompanySupervisorLocationAssignments(
      principal,
      companyId
    );
  }

  @Post("companies/:companyId/supervisors/:supervisorUserId/locations")
  assignSupervisorToCompanyLocation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Param("supervisorUserId") supervisorUserId: string,
    @Body() body: AssignSupervisorLocationBody
  ) {
    return this.companyOperationsService.assignSupervisorToCompanyLocation(
      principal,
      companyId,
      supervisorUserId,
      body.locationId
    );
  }

  @Delete("companies/:companyId/supervisors/:supervisorUserId/locations/:locationId")
  removeSupervisorFromCompanyLocation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Param("supervisorUserId") supervisorUserId: string,
    @Param("locationId") locationId: string
  ) {
    return this.companyOperationsService.removeSupervisorFromCompanyLocation(
      principal,
      companyId,
      supervisorUserId,
      locationId
    );
  }

  @Get("companies/:companyId/kiosks")
  listKiosks(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Query("includeArchived") includeArchived?: string,
    @Query("locationId") locationId?: string
  ) {
    return this.kioskAdminService.listKiosks(principal, companyId, {
      includeArchived: includeArchived === "true",
      locationId: locationId?.trim() || undefined
    });
  }

  @Post("companies/:companyId/kiosks")
  createKiosk(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("companyId") companyId: string,
    @Body() body: CreateKioskBody
  ) {
    return this.kioskAdminService.createKiosk(principal, companyId, body);
  }

  @Get("kiosks/:kioskId")
  getKiosk(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("kioskId") kioskId: string
  ) {
    return this.kioskAdminService.getKiosk(principal, kioskId);
  }

  @Post("kiosks/:kioskId")
  updateKiosk(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("kioskId") kioskId: string,
    @Body() body: UpdateKioskBody
  ) {
    return this.kioskAdminService.updateKiosk(principal, kioskId, body);
  }

  @Post("kiosks/:kioskId/archive")
  archiveKiosk(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("kioskId") kioskId: string
  ) {
    return this.kioskAdminService.archiveKiosk(principal, kioskId);
  }

  @Post("kiosks/:kioskId/unarchive")
  unarchiveKiosk(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("kioskId") kioskId: string
  ) {
    return this.kioskAdminService.unarchiveKiosk(principal, kioskId);
  }

  @Post("kiosks/:kioskId/rotate-secret")
  rotateKioskSecret(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("kioskId") kioskId: string
  ) {
    return this.kioskAdminService.rotateKioskSecret(principal, kioskId);
  }
}
