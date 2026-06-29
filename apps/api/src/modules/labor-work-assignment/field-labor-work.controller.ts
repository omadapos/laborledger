import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { LaborWorkProgressStatus } from "@prisma/client";

import { LaborWorkAssignmentService } from "./labor-work-assignment.service";

type FieldAuthBody = {
  companyId?: string;
  pin?: string;
};

type StartLaborWorkBody = FieldAuthBody & {
  serviceClientId?: string;
  locationId?: string;
  serviceCatalogItemId?: string;
  vehicleId?: string;
  vin?: string;
  notes?: string;
};

type ProgressLaborWorkBody = FieldAuthBody & {
  progressPercent?: number;
  progressStatus?: LaborWorkProgressStatus;
  referenceAction?: "prep_start" | "prep_complete" | "wash_start" | "wash_complete";
  notes?: string;
};

type BlockLaborWorkBody = FieldAuthBody & {
  blockedReason?: string;
};

@Controller("field/labor-work")
export class FieldLaborWorkController {
  constructor(
    @Inject(LaborWorkAssignmentService)
    private readonly laborWorkAssignmentService: LaborWorkAssignmentService
  ) {}

  @Get("active")
  /** Field reads use POST at this layer because employee PIN auth travels in the JSON body. */
  getActive(@Body() body: FieldAuthBody) {
    return this.laborWorkAssignmentService.getActiveAssignment({
      companyId: body.companyId ?? "",
      pin: body.pin ?? ""
    });
  }

  @Post("active")
  postActive(@Body() body: FieldAuthBody) {
    return this.getActive(body);
  }

  @Get("available-options")
  /** Field reads use POST at this layer because employee PIN auth travels in the JSON body. */
  getAvailableOptions(@Body() body: FieldAuthBody) {
    return this.laborWorkAssignmentService.getAvailableOptions({
      companyId: body.companyId ?? "",
      pin: body.pin ?? ""
    });
  }

  @Post("available-options")
  postAvailableOptions(@Body() body: FieldAuthBody) {
    return this.getAvailableOptions(body);
  }

  @Post("start")
  start(@Body() body: StartLaborWorkBody) {
    return this.laborWorkAssignmentService.startAssignment({
      companyId: body.companyId ?? "",
      pin: body.pin ?? "",
      serviceClientId: body.serviceClientId ?? "",
      locationId: body.locationId ?? "",
      serviceCatalogItemId: body.serviceCatalogItemId ?? "",
      vehicleId: body.vehicleId,
      vin: body.vin,
      notes: body.notes
    });
  }

  @Patch(":id/progress")
  updateProgress(@Param("id") id: string, @Body() body: ProgressLaborWorkBody) {
    const { companyId, pin, ...progress } = body;
    return this.laborWorkAssignmentService.updateProgress(
      id,
      { companyId: companyId ?? "", pin: pin ?? "" },
      progress
    );
  }

  @Post(":id/complete")
  complete(@Param("id") id: string, @Body() body: FieldAuthBody) {
    return this.laborWorkAssignmentService.completeAssignment(id, {
      companyId: body.companyId ?? "",
      pin: body.pin ?? ""
    });
  }

  @Post(":id/block")
  block(@Param("id") id: string, @Body() body: BlockLaborWorkBody) {
    return this.laborWorkAssignmentService.blockAssignment(
      id,
      { companyId: body.companyId ?? "", pin: body.pin ?? "" },
      { blockedReason: body.blockedReason ?? "" }
    );
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string, @Body() body: FieldAuthBody) {
    return this.laborWorkAssignmentService.cancelAssignment(id, {
      companyId: body.companyId ?? "",
      pin: body.pin ?? ""
    });
  }
}
