import { BadRequestException } from "@nestjs/common";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
export const MAX_OPERATIONS_REPORT_RANGE_DAYS = 366;

export type OperationsReportDateRange = {
  from: string;
  to: string;
  fromUtc: Date;
  toUtcExclusive: Date;
};

function parseDateKey(value: string, label: string) {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must use YYYY-MM-DD format.`);
  }

  const [year, month, day] = value.split("-").map((part) => Number(part));
  const utc = new Date(Date.UTC(year, month - 1, day));

  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${label} is not a valid calendar date.`);
  }

  return utc;
}

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function currentMonthStartUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function resolveOperationsReportDateRange(from?: string, to?: string): OperationsReportDateRange {
  const now = new Date();
  const resolvedTo = to?.trim() || formatDateKey(now);
  const resolvedFrom = from?.trim() || formatDateKey(currentMonthStartUtc());

  const fromUtc = parseDateKey(resolvedFrom, "from");
  const toUtc = parseDateKey(resolvedTo, "to");
  const toUtcExclusive = new Date(toUtc);
  toUtcExclusive.setUTCDate(toUtcExclusive.getUTCDate() + 1);

  if (fromUtc >= toUtcExclusive) {
    throw new BadRequestException("from must be on or before to.");
  }

  const rangeDays = Math.ceil((toUtcExclusive.getTime() - fromUtc.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_OPERATIONS_REPORT_RANGE_DAYS) {
    throw new BadRequestException(`Date range cannot exceed ${MAX_OPERATIONS_REPORT_RANGE_DAYS} days.`);
  }

  return {
    from: resolvedFrom,
    to: resolvedTo,
    fromUtc,
    toUtcExclusive
  };
}
