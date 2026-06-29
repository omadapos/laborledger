export type LaborPayBillingFilters = {
  weekStart: string;
  weekEnd: string;
  serviceClientId?: string;
  locationId?: string;
  employeeId?: string;
  onlyClosedWeeks: boolean;
};

export type LaborDataSource = "closed_snapshot" | "live_approved" | "none";

export type ShiftLaborRow = {
  shiftId: string;
  employeeId: string;
  employeeName: string;
  locationId: string;
  locationName: string;
  serviceClientId: string;
  serviceClientName: string;
  payableMinutes: number;
  employeeRateMinor: number;
  clientRateMinor: number;
  employeeAmountMinor: number;
  clientAmountMinor: number;
  grossMarginMinor: number;
};

export type EmployeePayPrepRow = {
  employeeId: string;
  employeeName: string;
  locationId: string;
  locationName: string;
  serviceClientId: string;
  serviceClientName: string;
  periodStart: string;
  periodEnd: string;
  approvedPayableMinutes: number;
  approvedPayableHoursDecimal: number;
  employeeRateMinor: number;
  estimatedGrossPayMinor: number;
  shiftCount: number;
  warnings: string[];
};

export type ClientLaborBillingRow = {
  serviceClientId: string;
  serviceClientName: string;
  locationId: string;
  locationName: string;
  employeeId: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  approvedBillableMinutes: number;
  approvedBillableHoursDecimal: number;
  clientLaborRateMinor: number;
  estimatedClientChargeMinor: number;
  estimatedGrossPayMinor: number;
  estimatedMarginMinor: number;
  shiftCount: number;
  warnings: string[];
};

export type ExcludedShiftWarning = {
  shiftId: string;
  employeeName: string;
  locationName: string;
  reasonCode: string;
  message: string;
};

export type LaborPayBillingPreview = {
  periodStart: string;
  periodEnd: string;
  weekStatus: "OPEN" | "CLOSED" | "REOPENED";
  dataSource: LaborDataSource;
  dataSourceLabel: string;
  snapshotVersion: number | null;
  currencyCode: string;
  employeePayPrep: EmployeePayPrepRow[];
  clientLaborBilling: ClientLaborBillingRow[];
  excludedShifts: ExcludedShiftWarning[];
  totals: {
    approvedShiftCount: number;
    payableMinutes: number;
    employeeGrossEstimateMinor: number;
    clientLaborEstimateMinor: number;
    grossMarginEstimateMinor: number;
  };
  filters: LaborPayBillingFilters;
  draftSupported: false;
};

export function minutesToHoursDecimal(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

function groupKey(parts: string[]) {
  return parts.join(":");
}

function weightedAverageRate(totalAmountMinor: number, totalMinutes: number, fallbackRateMinor: number) {
  if (totalMinutes <= 0) {
    return fallbackRateMinor;
  }

  return Math.round((totalAmountMinor * 60) / totalMinutes);
}

export function aggregateEmployeePayRows(
  rows: ShiftLaborRow[],
  periodStart: string,
  periodEnd: string
): EmployeePayPrepRow[] {
  const grouped = new Map<string, EmployeePayPrepRow & { rateAmountTotal: number }>();

  for (const row of rows) {
    const key = groupKey([row.employeeId, row.locationId, row.serviceClientId]);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        locationId: row.locationId,
        locationName: row.locationName,
        serviceClientId: row.serviceClientId,
        serviceClientName: row.serviceClientName,
        periodStart,
        periodEnd,
        approvedPayableMinutes: row.payableMinutes,
        approvedPayableHoursDecimal: minutesToHoursDecimal(row.payableMinutes),
        employeeRateMinor: row.employeeRateMinor,
        estimatedGrossPayMinor: row.employeeAmountMinor,
        shiftCount: 1,
        warnings: [],
        rateAmountTotal: row.employeeAmountMinor
      });
      continue;
    }

    existing.approvedPayableMinutes += row.payableMinutes;
    existing.approvedPayableHoursDecimal = minutesToHoursDecimal(existing.approvedPayableMinutes);
    existing.estimatedGrossPayMinor += row.employeeAmountMinor;
    existing.rateAmountTotal += row.employeeAmountMinor;
    existing.shiftCount += 1;
    existing.employeeRateMinor = weightedAverageRate(
      existing.rateAmountTotal,
      existing.approvedPayableMinutes,
      existing.employeeRateMinor
    );
  }

  return [...grouped.values()].map(({ rateAmountTotal: _ignored, ...row }) => row);
}

export function aggregateClientLaborBillingRows(
  rows: ShiftLaborRow[],
  periodStart: string,
  periodEnd: string
): ClientLaborBillingRow[] {
  const grouped = new Map<
    string,
    ClientLaborBillingRow & { clientRateAmountTotal: number; employeePayTotal: number }
  >();

  for (const row of rows) {
    const key = groupKey([row.serviceClientId, row.locationId, row.employeeId]);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        serviceClientId: row.serviceClientId,
        serviceClientName: row.serviceClientName,
        locationId: row.locationId,
        locationName: row.locationName,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        periodStart,
        periodEnd,
        approvedBillableMinutes: row.payableMinutes,
        approvedBillableHoursDecimal: minutesToHoursDecimal(row.payableMinutes),
        clientLaborRateMinor: row.clientRateMinor,
        estimatedClientChargeMinor: row.clientAmountMinor,
        estimatedGrossPayMinor: row.employeeAmountMinor,
        estimatedMarginMinor: row.grossMarginMinor,
        shiftCount: 1,
        warnings: [],
        clientRateAmountTotal: row.clientAmountMinor,
        employeePayTotal: row.employeeAmountMinor
      });
      continue;
    }

    existing.approvedBillableMinutes += row.payableMinutes;
    existing.approvedBillableHoursDecimal = minutesToHoursDecimal(existing.approvedBillableMinutes);
    existing.estimatedClientChargeMinor += row.clientAmountMinor;
    existing.estimatedGrossPayMinor += row.employeeAmountMinor;
    existing.estimatedMarginMinor += row.grossMarginMinor;
    existing.clientRateAmountTotal += row.clientAmountMinor;
    existing.employeePayTotal += row.employeeAmountMinor;
    existing.shiftCount += 1;
    existing.clientLaborRateMinor = weightedAverageRate(
      existing.clientRateAmountTotal,
      existing.approvedBillableMinutes,
      existing.clientLaborRateMinor
    );
  }

  return [...grouped.values()].map(
    ({ clientRateAmountTotal: _a, employeePayTotal: _b, ...row }) => row
  );
}

export function summarizeLaborRows(rows: ShiftLaborRow[]) {
  let approvedShiftCount = 0;
  let payableMinutes = 0;
  let employeeGrossEstimateMinor = 0;
  let clientLaborEstimateMinor = 0;

  for (const row of rows) {
    approvedShiftCount += 1;
    payableMinutes += row.payableMinutes;
    employeeGrossEstimateMinor += row.employeeAmountMinor;
    clientLaborEstimateMinor += row.clientAmountMinor;
  }

  return {
    approvedShiftCount,
    payableMinutes,
    employeeGrossEstimateMinor,
    clientLaborEstimateMinor,
    grossMarginEstimateMinor: clientLaborEstimateMinor - employeeGrossEstimateMinor
  };
}

export function parseOnlyClosedWeeks(value?: string | boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  return value === "true" || value === "1";
}

export function dataSourceLabel(source: LaborDataSource) {
  switch (source) {
    case "closed_snapshot":
      return "Closed week snapshot (immutable totals)";
    case "live_approved":
      return "Not closed — live approved shifts only";
    default:
      return "No payable data — week is not closed";
  }
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function formatRateCsv(rateMinor: number) {
  return (rateMinor / 100).toFixed(2);
}

function formatMoneyCsv(minor: number) {
  return (minor / 100).toFixed(2);
}

export function buildEmployeePayCsv(rows: EmployeePayPrepRow[]) {
  const header = [
    "employee_name",
    "employee_id",
    "service_client",
    "location",
    "period_start",
    "period_end",
    "approved_minutes",
    "approved_hours",
    "employee_rate",
    "estimated_gross_pay"
  ].join(",");

  const lines = rows.map((row) =>
    [
      escapeCsvCell(row.employeeName),
      escapeCsvCell(row.employeeId),
      escapeCsvCell(row.serviceClientName),
      escapeCsvCell(row.locationName),
      escapeCsvCell(row.periodStart),
      escapeCsvCell(row.periodEnd),
      escapeCsvCell(row.approvedPayableMinutes),
      escapeCsvCell(row.approvedPayableHoursDecimal),
      escapeCsvCell(formatRateCsv(row.employeeRateMinor)),
      escapeCsvCell(formatMoneyCsv(row.estimatedGrossPayMinor))
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

export type ClientLaborBillingWorkContextRow = {
  weekStart: string;
  employeeName: string;
  serviceClientName: string;
  workAddress: string;
  serviceName: string;
  approvedClockMinutes: number;
  billableLaborMinutes: number;
  laborRateMinor: number;
  estimatedClientChargeMinor: number;
  workStatus: string;
  workProgress: string;
  referencePrepMinutes: number | null;
  referenceWashMinutes: number | null;
  referenceServiceMinutes: number | null;
};

export function buildClientBillingWorkContextRow(
  billingRow: ClientLaborBillingRow,
  weekStart: string,
  assignment?: {
    addressSnapshot: string;
    serviceNameSnapshot: string;
    status: string;
    progressPercent: number;
    referencePrepMinutes: number | null;
    referenceWashMinutes: number | null;
    referenceServiceMinutes: number | null;
  }
): ClientLaborBillingWorkContextRow {
  return {
    weekStart,
    employeeName: billingRow.employeeName,
    serviceClientName: billingRow.serviceClientName,
    workAddress: assignment?.addressSnapshot ?? billingRow.locationName,
    serviceName: assignment?.serviceNameSnapshot ?? "",
    approvedClockMinutes: billingRow.approvedBillableMinutes,
    billableLaborMinutes: billingRow.approvedBillableMinutes,
    laborRateMinor: billingRow.clientLaborRateMinor,
    estimatedClientChargeMinor: billingRow.estimatedClientChargeMinor,
    workStatus: assignment?.status ?? "",
    workProgress: assignment ? String(assignment.progressPercent) : "",
    referencePrepMinutes: assignment?.referencePrepMinutes ?? null,
    referenceWashMinutes: assignment?.referenceWashMinutes ?? null,
    referenceServiceMinutes: assignment?.referenceServiceMinutes ?? null
  };
}

export function buildClientBillingCsv(rows: ClientLaborBillingRow[]) {
  const header = [
    "service_client",
    "location",
    "employee_name",
    "period_start",
    "period_end",
    "billable_minutes",
    "billable_hours",
    "client_labor_rate",
    "estimated_client_charge"
  ].join(",");

  const lines = rows.map((row) =>
    [
      escapeCsvCell(row.serviceClientName),
      escapeCsvCell(row.locationName),
      escapeCsvCell(row.employeeName),
      escapeCsvCell(row.periodStart),
      escapeCsvCell(row.periodEnd),
      escapeCsvCell(row.approvedBillableMinutes),
      escapeCsvCell(row.approvedBillableHoursDecimal),
      escapeCsvCell(formatRateCsv(row.clientLaborRateMinor)),
      escapeCsvCell(formatMoneyCsv(row.estimatedClientChargeMinor))
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

export function buildClientBillingCsvWithWorkContext(rows: ClientLaborBillingWorkContextRow[]) {
  const header = [
    "week_start",
    "employee_name",
    "service_client",
    "work_address",
    "service_name",
    "approved_clock_minutes",
    "billable_labor_minutes",
    "labor_rate",
    "estimated_client_charge",
    "work_status",
    "work_progress",
    "reference_prep_minutes",
    "reference_wash_minutes",
    "reference_service_minutes"
  ].join(",");

  const lines = rows.map((row) => {
    const chargeMinor =
      row.billableLaborMinutes * row.laborRateMinor === row.estimatedClientChargeMinor
        ? row.estimatedClientChargeMinor
        : Math.round((row.billableLaborMinutes * row.laborRateMinor) / 60);

    return [
      escapeCsvCell(row.weekStart),
      escapeCsvCell(row.employeeName),
      escapeCsvCell(row.serviceClientName),
      escapeCsvCell(row.workAddress),
      escapeCsvCell(row.serviceName),
      escapeCsvCell(row.approvedClockMinutes),
      escapeCsvCell(row.billableLaborMinutes),
      escapeCsvCell(formatRateCsv(row.laborRateMinor)),
      escapeCsvCell(formatMoneyCsv(chargeMinor)),
      escapeCsvCell(row.workStatus),
      escapeCsvCell(row.workProgress),
      escapeCsvCell(row.referencePrepMinutes ?? ""),
      escapeCsvCell(row.referenceWashMinutes ?? ""),
      escapeCsvCell(row.referenceServiceMinutes ?? "")
    ].join(",");
  });

  return [header, ...lines].join("\n");
}

export function matchesLaborFilters(
  row: Pick<ShiftLaborRow, "employeeId" | "locationId" | "serviceClientId">,
  filters: Pick<LaborPayBillingFilters, "employeeId" | "locationId" | "serviceClientId">
) {
  if (filters.employeeId && row.employeeId !== filters.employeeId) {
    return false;
  }

  if (filters.locationId && row.locationId !== filters.locationId) {
    return false;
  }

  if (filters.serviceClientId && row.serviceClientId !== filters.serviceClientId) {
    return false;
  }

  return true;
}
