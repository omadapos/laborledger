import { describe, expect, it } from "vitest";

import { formatShiftStatus, mapFieldClockStatus } from "../../apps/field/src/lib/field-clock-utils";

describe("Field clock utils", () => {
  it("maps punch states to employee-facing shift labels", () => {
    expect(formatShiftStatus("scheduled")).toBe("Not clocked in");
    expect(formatShiftStatus("clocked_in")).toBe("On shift");
    expect(formatShiftStatus("on_break")).toBe("On break");
    expect(formatShiftStatus("clocked_out")).toBe("Clocked out");
  });

  it("maps kiosk session payload to Field clock status", () => {
    expect(
      mapFieldClockStatus({
        employeeName: "Alex Rivera",
        punchState: "clocked_in",
        allowedActions: ["break_start", "clock_out"],
        workedMinutes: null,
        warnings: ["Late clock-in"]
      })
    ).toEqual({
      employeeName: "Alex Rivera",
      shiftStatus: "On shift",
      punchState: "clocked_in",
      allowedActions: ["break_start", "clock_out"],
      workedMinutes: null,
      warnings: ["Late clock-in"],
      timezone: null,
      scheduledStartUtc: null,
      scheduledEndUtc: null
    });
  });
});
