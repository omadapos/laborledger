import { Body, Controller, Inject, Param, Post } from "@nestjs/common";

import { FieldJobService } from "./field-job.service";
import { WorkerResponsibilityService } from "./worker-responsibility.service";

type WorkerLookupBody = {
  companyId?: string;
  pin?: string;
};

type WorkerScanBody = {
  companyId?: string;
  pin?: string;
  workOrderId?: string;
  workOrderAssignmentId?: string;
  enteredVin?: string;
  deviceLabel?: string;
  idempotencyKey?: string;
};

type WorkerCompleteServiceBody = {
  companyId?: string;
  pin?: string;
  notes?: string;
};

type WorkerFieldJobAuthBody = {
  companyId?: string;
  pin?: string;
};

type WorkerFieldJobCreateBody = WorkerFieldJobAuthBody & {
  enteredVin?: string;
  serviceClientId?: string;
  locationId?: string;
  serviceCatalogItemId?: string;
  notes?: string;
};

@Controller("worker")
export class WorkerController {
  constructor(
    @Inject(WorkerResponsibilityService)
    private readonly workerResponsibilityService: WorkerResponsibilityService,
    @Inject(FieldJobService) private readonly fieldJobService: FieldJobService
  ) {}

  @Post("lookup")
  lookup(@Body() body: WorkerLookupBody) {
    return this.workerResponsibilityService.lookup({
      companyId: body.companyId ?? "",
      pin: body.pin ?? ""
    });
  }

  @Post("scan")
  scan(@Body() body: WorkerScanBody) {
    return this.workerResponsibilityService.scan({
      companyId: body.companyId ?? "",
      pin: body.pin ?? "",
      workOrderId: body.workOrderId ?? "",
      workOrderAssignmentId: body.workOrderAssignmentId,
      enteredVin: body.enteredVin ?? "",
      deviceLabel: body.deviceLabel,
      idempotencyKey: body.idempotencyKey
    });
  }

  @Post("service-lines/:workOrderServiceLineId/complete")
  completeServiceLine(
    @Param("workOrderServiceLineId") workOrderServiceLineId: string,
    @Body() body: WorkerCompleteServiceBody
  ) {
    return this.workerResponsibilityService.completeServiceLine({
      companyId: body.companyId ?? "",
      pin: body.pin ?? "",
      workOrderServiceLineId,
      notes: body.notes
    });
  }

  @Post("jobs/options")
  fieldJobOptions(@Body() body: WorkerFieldJobAuthBody) {
    return this.fieldJobService.getJobOptions({
      companyId: body.companyId ?? "",
      pin: body.pin ?? ""
    });
  }

  @Post("jobs/create")
  createFieldJob(@Body() body: WorkerFieldJobCreateBody) {
    return this.fieldJobService.createAndCompleteJob({
      companyId: body.companyId ?? "",
      pin: body.pin ?? "",
      enteredVin: body.enteredVin ?? "",
      serviceClientId: body.serviceClientId ?? "",
      locationId: body.locationId ?? "",
      serviceCatalogItemId: body.serviceCatalogItemId ?? "",
      notes: body.notes
    });
  }

  @Post("jobs/recent-completions")
  recentFieldJobCompletions(@Body() body: WorkerFieldJobAuthBody & { limit?: number }) {
    return this.fieldJobService.listRecentCompletions(
      {
        companyId: body.companyId ?? "",
        pin: body.pin ?? ""
      },
      body.limit
    );
  }
}
