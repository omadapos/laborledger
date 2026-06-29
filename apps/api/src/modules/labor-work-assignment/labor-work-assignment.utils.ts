import type { LaborWorkAssignment, PunchEvent } from "@prisma/client";
import { PunchAction } from "@prisma/client";

import { derivePunchState, type PunchEventRecord } from "../kiosk/punch-state";

export const ACTIVE_LABOR_WORK_STATUSES = ["IN_PROGRESS"] as const;

export const VALID_PROGRESS_PERCENTS = [0, 25, 50, 75, 100] as const;

export type LaborWorkAssignmentRecord = LaborWorkAssignment;

export function toPunchEventRecords(events: PunchEvent[]): PunchEventRecord[] {
  return events.map((event) => ({
    action: event.action,
    eventUtc: event.eventUtc,
    breakMinutes: event.breakMinutes
  }));
}

export function findActiveClockedInShift<T extends { punchEvents: PunchEvent[] }>(shifts: T[]) {
  for (const shift of shifts) {
    const state = derivePunchState(toPunchEventRecords(shift.punchEvents));
    if (state === "clocked_in" || state === "on_break") {
      return shift;
    }
  }

  return null;
}

export function computeReferenceMinutes(input: {
  referencePrepStartedAt: Date | null;
  referencePrepCompletedAt: Date | null;
  referenceWashStartedAt: Date | null;
  referenceWashCompletedAt: Date | null;
  startedAt: Date;
  completedAt: Date;
}) {
  const referencePrepMinutes =
    input.referencePrepStartedAt && input.referencePrepCompletedAt
      ? Math.max(
          0,
          Math.round(
            (input.referencePrepCompletedAt.getTime() - input.referencePrepStartedAt.getTime()) /
              60_000
          )
        )
      : null;

  const referenceWashMinutes =
    input.referenceWashStartedAt && input.referenceWashCompletedAt
      ? Math.max(
          0,
          Math.round(
            (input.referenceWashCompletedAt.getTime() - input.referenceWashStartedAt.getTime()) /
              60_000
          )
        )
      : null;

  const referenceServiceMinutes = Math.max(
    0,
    Math.round((input.completedAt.getTime() - input.startedAt.getTime()) / 60_000)
  );

  return {
    referencePrepMinutes,
    referenceWashMinutes,
    referenceServiceMinutes
  };
}

export function mapLaborWorkAssignment(assignment: LaborWorkAssignment) {
  return {
    id: assignment.id,
    companyId: assignment.companyId,
    employeeId: assignment.employeeId,
    shiftId: assignment.shiftId,
    serviceClientId: assignment.serviceClientId,
    locationId: assignment.locationId,
    serviceCatalogItemId: assignment.serviceCatalogItemId,
    vehicleId: assignment.vehicleId,
    vinSnapshot: assignment.vinSnapshot,
    employeeName: assignment.employeeNameSnapshot,
    clientName: assignment.clientNameSnapshot,
    locationName: assignment.locationNameSnapshot,
    address: assignment.addressSnapshot,
    serviceName: assignment.serviceNameSnapshot,
    status: assignment.status,
    progressPercent: assignment.progressPercent,
    progressStatus: assignment.progressStatus,
    startedAt: assignment.startedAt.toISOString(),
    completedAt: assignment.completedAt?.toISOString() ?? null,
    cancelledAt: assignment.cancelledAt?.toISOString() ?? null,
    blockedAt: assignment.blockedAt?.toISOString() ?? null,
    referencePrepStartedAt: assignment.referencePrepStartedAt?.toISOString() ?? null,
    referencePrepCompletedAt: assignment.referencePrepCompletedAt?.toISOString() ?? null,
    referenceWashStartedAt: assignment.referenceWashStartedAt?.toISOString() ?? null,
    referenceWashCompletedAt: assignment.referenceWashCompletedAt?.toISOString() ?? null,
    referenceServiceMinutes: assignment.referenceServiceMinutes,
    referencePrepMinutes: assignment.referencePrepMinutes,
    referenceWashMinutes: assignment.referenceWashMinutes,
    notes: assignment.notes,
    blockedReason: assignment.blockedReason,
    billingSourceReminder:
      "Billable labor hours come from approved clock/punch time. Service timers are reference only."
  };
}

export function shiftClockInUtc(events: PunchEvent[]) {
  const clockIn = events.find((event) => event.action === PunchAction.CLOCK_IN);
  return clockIn?.eventUtc ?? null;
}
