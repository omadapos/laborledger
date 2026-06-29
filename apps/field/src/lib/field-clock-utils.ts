import type { KioskSessionPayload } from "@/lib/field-kiosk-client";

export const FIELD_CLOCK_ACTIONS = {
  clock_in: "Clock in",
  break_start: "Start break",
  break_end: "End break",
  clock_out: "Clock out"
} as const;

export type FieldClockAction = keyof typeof FIELD_CLOCK_ACTIONS;

export function formatShiftStatus(punchState?: string): string {
  switch (punchState) {
    case "scheduled":
      return "Not clocked in";
    case "clocked_in":
      return "On shift";
    case "on_break":
      return "On break";
    case "clocked_out":
      return "Clocked out";
    default:
      return "Unknown";
  }
}

export function mapFieldClockStatus(payload: KioskSessionPayload) {
  return {
    employeeName: payload.employeeName ?? null,
    shiftStatus: formatShiftStatus(payload.punchState),
    punchState: payload.punchState ?? null,
    allowedActions: payload.allowedActions ?? [],
    workedMinutes: payload.workedMinutes ?? null,
    warnings: payload.warnings ?? [],
    timezone: payload.timezone ?? null,
    scheduledStartUtc: payload.scheduledStartUtc ?? null,
    scheduledEndUtc: payload.scheduledEndUtc ?? null
  };
}
