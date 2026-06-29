import { CorrectionType, PunchAction } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildEffectivePunchEvents,
  buildProposedEvents,
  computeWorkedMinuteImpact
} from "../src/modules/corrections/punch-corrections";

const baseEvents = [
  {
    id: "in-1",
    action: PunchAction.CLOCK_IN,
    eventUtc: new Date("2026-04-06T13:00:00.000Z"),
    isLate: false,
    isEarly: false,
    breakMinutes: null
  },
  {
    id: "break-1",
    action: PunchAction.BREAK_START,
    eventUtc: new Date("2026-04-06T17:00:00.000Z"),
    isLate: false,
    isEarly: false,
    breakMinutes: null
  }
];

describe("punch corrections domain", () => {
  it("adds a missing clock-out through the effective overlay", () => {
    const proposed = buildProposedEvents(
      baseEvents,
      [],
      CorrectionType.MISSING_CLOCK_OUT,
      { eventUtc: new Date("2026-04-06T21:00:00.000Z") },
      {
        scheduledStartUtc: new Date("2026-04-06T13:00:00.000Z"),
        scheduledEndUtc: new Date("2026-04-06T21:00:00.000Z")
      }
    );

    expect(proposed.some((event) => event.action === PunchAction.CLOCK_OUT)).toBe(true);
  });

  it("preserves original kiosk events while overlay changes worked minutes", () => {
    const applied = buildEffectivePunchEvents(baseEvents, [
      {
        id: "corr-1",
        targetPunchEventId: null,
        action: PunchAction.CLOCK_OUT,
        eventUtc: new Date("2026-04-06T21:00:00.000Z"),
        breakMinutes: null,
        isLate: false,
        isEarly: false
      }
    ]);

    expect(baseEvents).toHaveLength(2);
    expect(applied).toHaveLength(3);

    const impact = computeWorkedMinuteImpact({
      scheduledEndUtc: new Date("2026-04-06T21:00:00.000Z"),
      approvedAt: null,
      additionalTimeApprovedAt: null,
      punchEvents: baseEvents,
      punchCorrections: [],
      proposedEvents: applied
    });

    expect(impact.originalWorkedMinutes).toBeNull();
    expect(impact.proposedWorkedMinutes).toBe(480);
  });
});
