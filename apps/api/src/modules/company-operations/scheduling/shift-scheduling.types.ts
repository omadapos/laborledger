export type ShiftScheduleConflict = {
  employeeId: string;
  employeeName: string | null;
  conflictingShiftId: string;
  scheduledStart: string;
  scheduledEnd: string;
  locationName: string | null;
  reason: string;
};

export type CopyWeekSkippedEntry = {
  sourceShiftId: string;
  reason: string;
};

export type CopyWeekCreatedEntry = {
  shiftId: string;
  employeeId: string;
  employeeName: string | null;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
};

export type CopyWeekResult = {
  batchId: string;
  created: CopyWeekCreatedEntry[];
  skipped: CopyWeekSkippedEntry[];
  conflicts: ShiftScheduleConflict[];
  summary: {
    createdCount: number;
    skippedCount: number;
    conflictCount: number;
  };
};
