import { CorrectionType, PunchAction } from "@prisma/client";

import {
  derivePunchState,
  evaluateClockInTiming,
  minutesBetween,
  type PunchEventRecord
} from "../kiosk/punch-state";
import { buildShiftReview } from "../shift-review/shift-review";

export type StoredCorrectionPayload = {
  punchEventId?: string;
  action?: PunchAction;
  eventUtc?: string;
  breakMinutes?: number | null;
};

export type PunchCorrectionRecord = {
  id: string;
  targetPunchEventId: string | null;
  action: PunchAction;
  eventUtc: Date;
  breakMinutes: number | null;
  isLate: boolean;
  isEarly: boolean;
};

export type TimelineEntry = {
  id: string;
  action: PunchAction;
  eventUtc: string;
  isLate: boolean;
  isEarly: boolean;
  breakMinutes: number | null;
  source: "kiosk" | "correction";
  originalEventUtc: string | null;
  punchEventId: string | null;
  correctionId: string | null;
};

export function correctionTypeLabel(type: CorrectionType) {
  switch (type) {
    case CorrectionType.MISSING_CLOCK_OUT:
      return "Missing clock-out";
    case CorrectionType.OPEN_BREAK_END:
      return "Open break end";
    case CorrectionType.INCORRECT_CLOCK_IN:
      return "Incorrect clock-in time";
    case CorrectionType.INCORRECT_CLOCK_OUT:
      return "Incorrect clock-out time";
    case CorrectionType.INCORRECT_BREAK_START:
      return "Incorrect break start";
    case CorrectionType.INCORRECT_BREAK_END:
      return "Incorrect break end";
    default:
      return type;
  }
}

export function correctionTypeToAction(type: CorrectionType): PunchAction {
  switch (type) {
    case CorrectionType.MISSING_CLOCK_OUT:
      return PunchAction.CLOCK_OUT;
    case CorrectionType.OPEN_BREAK_END:
    case CorrectionType.INCORRECT_BREAK_END:
      return PunchAction.BREAK_END;
    case CorrectionType.INCORRECT_CLOCK_IN:
      return PunchAction.CLOCK_IN;
    case CorrectionType.INCORRECT_CLOCK_OUT:
      return PunchAction.CLOCK_OUT;
    case CorrectionType.INCORRECT_BREAK_START:
      return PunchAction.BREAK_START;
    default:
      return PunchAction.CLOCK_OUT;
  }
}

export function buildEffectivePunchEvents(
  punchEvents: Array<{
    id: string;
    action: PunchAction;
    eventUtc: Date;
    isLate: boolean;
    isEarly: boolean;
    breakMinutes: number | null;
  }>,
  punchCorrections: PunchCorrectionRecord[]
): PunchEventRecord[] {
  const overrides = new Map(
    punchCorrections
      .filter((correction) => correction.targetPunchEventId)
      .map((correction) => [correction.targetPunchEventId as string, correction])
  );

  const merged: PunchEventRecord[] = punchEvents.map((event) => {
    const override = overrides.get(event.id);
    if (!override) {
      return {
        action: event.action,
        eventUtc: event.eventUtc,
        isLate: event.isLate,
        isEarly: event.isEarly,
        breakMinutes: event.breakMinutes
      };
    }

    return {
      action: override.action,
      eventUtc: override.eventUtc,
      isLate: override.isLate,
      isEarly: override.isEarly,
      breakMinutes: override.breakMinutes
    };
  });

  for (const correction of punchCorrections.filter((entry) => !entry.targetPunchEventId)) {
    merged.push({
      action: correction.action,
      eventUtc: correction.eventUtc,
      isLate: correction.isLate,
      isEarly: correction.isEarly,
      breakMinutes: correction.breakMinutes
    });
  }

  merged.sort((left, right) => left.eventUtc.getTime() - right.eventUtc.getTime());
  return merged;
}

export function buildPunchTimeline(
  punchEvents: Array<{
    id: string;
    action: PunchAction;
    eventUtc: Date;
    isLate: boolean;
    isEarly: boolean;
    breakMinutes: number | null;
  }>,
  punchCorrections: PunchCorrectionRecord[]
): TimelineEntry[] {
  const overrideByTarget = new Map(
    punchCorrections
      .filter((correction) => correction.targetPunchEventId)
      .map((correction) => [correction.targetPunchEventId as string, correction])
  );

  const timeline: TimelineEntry[] = punchEvents.map((event) => {
    const override = overrideByTarget.get(event.id);
    if (!override) {
      return {
        id: event.id,
        action: event.action,
        eventUtc: event.eventUtc.toISOString(),
        isLate: event.isLate,
        isEarly: event.isEarly,
        breakMinutes: event.breakMinutes,
        source: "kiosk" as const,
        originalEventUtc: null,
        punchEventId: event.id,
        correctionId: null
      };
    }

    return {
      id: override.id,
      action: override.action,
      eventUtc: override.eventUtc.toISOString(),
      isLate: override.isLate,
      isEarly: override.isEarly,
      breakMinutes: override.breakMinutes,
      source: "correction" as const,
      originalEventUtc: event.eventUtc.toISOString(),
      punchEventId: event.id,
      correctionId: override.id
    };
  });

  for (const correction of punchCorrections.filter((entry) => !entry.targetPunchEventId)) {
    timeline.push({
      id: correction.id,
      action: correction.action,
      eventUtc: correction.eventUtc.toISOString(),
      isLate: correction.isLate,
      isEarly: correction.isEarly,
      breakMinutes: correction.breakMinutes,
      source: "correction",
      originalEventUtc: null,
      punchEventId: null,
      correctionId: correction.id
    });
  }

  timeline.sort((left, right) => left.eventUtc.localeCompare(right.eventUtc));
  return timeline;
}

export function computeWorkedMinuteImpact(input: {
  scheduledEndUtc: Date;
  approvedAt: Date | null;
  additionalTimeApprovedAt: Date | null;
  punchEvents: Array<{
    id: string;
    action: PunchAction;
    eventUtc: Date;
    isLate: boolean;
    isEarly: boolean;
    breakMinutes: number | null;
  }>;
  punchCorrections: PunchCorrectionRecord[];
  proposedEvents: PunchEventRecord[];
}) {
  const originalReview = buildShiftReview({
    approvedAt: input.approvedAt,
    additionalTimeApprovedAt: input.additionalTimeApprovedAt,
    scheduledEndUtc: input.scheduledEndUtc,
    events: buildEffectivePunchEvents(input.punchEvents, input.punchCorrections)
  });

  const proposedReview = buildShiftReview({
    approvedAt: input.approvedAt,
    additionalTimeApprovedAt: input.additionalTimeApprovedAt,
    scheduledEndUtc: input.scheduledEndUtc,
    events: input.proposedEvents
  });

  return {
    originalWorkedMinutes: originalReview.workedMinutes,
    proposedWorkedMinutes: proposedReview.workedMinutes,
    originalPayableMinutes: originalReview.payableMinutes,
    proposedPayableMinutes: proposedReview.payableMinutes,
    originalPunchState: originalReview.punchState,
    proposedPunchState: proposedReview.punchState
  };
}

export function buildProposedEvents(
  punchEvents: Array<{
    id: string;
    action: PunchAction;
    eventUtc: Date;
    isLate: boolean;
    isEarly: boolean;
    breakMinutes: number | null;
  }>,
  punchCorrections: PunchCorrectionRecord[],
  type: CorrectionType,
  proposed: {
    eventUtc: Date;
    punchEventId?: string;
    breakMinutes?: number | null;
  },
  shift: {
    scheduledStartUtc: Date;
    scheduledEndUtc: Date;
  }
): PunchEventRecord[] {
  const action = correctionTypeToAction(type);
  const effectiveEvents = buildEffectivePunchEvents(punchEvents, punchCorrections);

  let breakMinutes: number | null = null;
  let isLate = false;
  let isEarly = false;

  if (action === PunchAction.CLOCK_IN) {
    const timing = evaluateClockInTiming({
      now: proposed.eventUtc,
      scheduledStartUtc: shift.scheduledStartUtc,
      scheduledEndUtc: shift.scheduledEndUtc
    });
    if (!timing.allowed) {
      throw new Error(timing.reason);
    }
    isLate = timing.isLate;
    isEarly = timing.isEarly;
  }

  if (action === PunchAction.BREAK_END) {
    const breakStart = effectiveEvents.find((event) => event.action === PunchAction.BREAK_START);
    breakMinutes =
      proposed.breakMinutes ??
      (breakStart ? minutesBetween(breakStart.eventUtc, proposed.eventUtc) : null);
  }

  const simulated: PunchCorrectionRecord = {
    id: "preview",
    targetPunchEventId:
      type === CorrectionType.MISSING_CLOCK_OUT || type === CorrectionType.OPEN_BREAK_END
        ? null
        : (proposed.punchEventId ?? null),
    action,
    eventUtc: proposed.eventUtc,
    breakMinutes,
    isLate,
    isEarly
  };

  if (
    simulated.targetPunchEventId &&
    !punchEvents.some((event) => event.id === simulated.targetPunchEventId)
  ) {
    throw new Error("Target punch event not found.");
  }

  return buildEffectivePunchEvents(punchEvents, [...punchCorrections, simulated]);
}

export function serializePayload(payload: StoredCorrectionPayload) {
  return {
    punchEventId: payload.punchEventId ?? null,
    action: payload.action ?? null,
    eventUtc: payload.eventUtc ?? null,
    breakMinutes: payload.breakMinutes ?? null
  };
}

export function mapAppliedCorrections(
  records: Array<{
    id: string;
    targetPunchEventId: string | null;
    action: PunchAction;
    eventUtc: Date;
    breakMinutes: number | null;
    isLate: boolean;
    isEarly: boolean;
  }>
): PunchCorrectionRecord[] {
  return records.map((record) => ({
    id: record.id,
    targetPunchEventId: record.targetPunchEventId,
    action: record.action,
    eventUtc: record.eventUtc,
    breakMinutes: record.breakMinutes,
    isLate: record.isLate,
    isEarly: record.isEarly
  }));
}

export function deriveCurrentState(
  punchEvents: Parameters<typeof buildEffectivePunchEvents>[0],
  punchCorrections: PunchCorrectionRecord[]
) {
  return derivePunchState(buildEffectivePunchEvents(punchEvents, punchCorrections));
}
