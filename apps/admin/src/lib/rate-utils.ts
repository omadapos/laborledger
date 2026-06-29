import { formatHourlyRate } from "./employee-utils";

export type EffectiveRateRecord = {
  id: string;
  rateMinorUnits: number;
  currencyCode: string;
  effectiveStart: string;
  effectiveEnd: string | null;
};

export const DEFAULT_EMPLOYEE_RATE_MINOR = 1900;
export const DEFAULT_EMPLOYEE_RATE_USD = 19;
export const DEFAULT_CLIENT_LABOR_RATE_MINOR = 2300;
export const DEFAULT_CLIENT_LABOR_RATE_USD = 23;

export type RateSourceLabel = "Default" | "Override";

export type EmployeeRateView = {
  employeeId: string;
  employeeName: string;
  archivedAt: string | null;
  rateMinorUnits: number;
  currencyCode: string;
  effectiveStart: string;
  effectiveEnd: string | null;
  source: RateSourceLabel;
};

export type ClientLaborRateView = {
  serviceClientId: string;
  serviceClientName: string;
  archivedAt: string | null;
  rateMinorUnits: number;
  currencyCode: string;
  effectiveStart: string;
  effectiveEnd: string | null;
  source: RateSourceLabel;
};

export type LocationLaborRateView = {
  locationId: string;
  locationName: string;
  archivedAt: string | null;
  rateMinorUnits: number;
  currencyCode: string;
  effectiveStart: string;
  effectiveEnd: string | null;
  source: RateSourceLabel;
};

export function resolveCurrentRate(rates: EffectiveRateRecord[], at = new Date()) {
  const activeRates = rates.filter((rate) => {
    const start = new Date(rate.effectiveStart);
    const end = rate.effectiveEnd ? new Date(rate.effectiveEnd) : null;
    return start <= at && (!end || end > at);
  });

  if (activeRates.length === 0) {
    return null;
  }

  return activeRates.reduce((latest, rate) =>
    new Date(rate.effectiveStart) > new Date(latest.effectiveStart) ? rate : latest
  );
}

export function classifyRateSource(
  currentRate: EffectiveRateRecord | null,
  allRates: EffectiveRateRecord[],
  defaultMinorUnits: number
): RateSourceLabel {
  if (!currentRate) {
    return "Default";
  }

  if (allRates.length > 1 || currentRate.rateMinorUnits !== defaultMinorUnits) {
    return "Override";
  }

  return "Default";
}

export function formatEffectiveDate(value?: string | null) {
  if (!value) {
    return "Open-ended";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

export function formatRateDisplay(rateMinorUnits: number, currencyCode = "USD") {
  return `${formatHourlyRate(rateMinorUnits, currencyCode)}/hr`;
}

export function grossMarginDisclaimerCopy() {
  return "Estimated gross margin equals the internal client labor charge estimate minus employee gross-pay estimate. It excludes taxes and other business costs.";
}

export function buildEmployeeRateViews(
  employees: Array<{ id: string; fullName: string; archivedAt: string | null }>,
  ratesByEmployeeId: ReadonlyMap<string, EffectiveRateRecord[]>
): EmployeeRateView[] {
  return employees
    .filter((employee) => !employee.archivedAt)
    .flatMap((employee) => {
      const rates = ratesByEmployeeId.get(employee.id) ?? [];
      const current = resolveCurrentRate(rates);
      if (!current) {
        return [];
      }

      return [
        {
          employeeId: employee.id,
          employeeName: employee.fullName,
          archivedAt: employee.archivedAt,
          rateMinorUnits: current.rateMinorUnits,
          currencyCode: current.currencyCode,
          effectiveStart: current.effectiveStart,
          effectiveEnd: current.effectiveEnd,
          source: classifyRateSource(current, rates, DEFAULT_EMPLOYEE_RATE_MINOR)
        }
      ];
    });
}

export function buildClientLaborRateViews(
  serviceClients: Array<{ id: string; name: string; archivedAt: string | null }>,
  ratesByClientId: ReadonlyMap<string, EffectiveRateRecord[]>
): ClientLaborRateView[] {
  return serviceClients
    .filter((client) => !client.archivedAt)
    .flatMap((client) => {
      const rates = ratesByClientId.get(client.id) ?? [];
      const current = resolveCurrentRate(rates);
      if (!current) {
        return [];
      }

      return [
        {
          serviceClientId: client.id,
          serviceClientName: client.name,
          archivedAt: client.archivedAt,
          rateMinorUnits: current.rateMinorUnits,
          currencyCode: current.currencyCode,
          effectiveStart: current.effectiveStart,
          effectiveEnd: current.effectiveEnd,
          source: classifyRateSource(current, rates, DEFAULT_CLIENT_LABOR_RATE_MINOR)
        }
      ];
    });
}

export function buildLocationLaborRateViews(
  locations: Array<{ id: string; name: string; archivedAt: string | null }>,
  ratesByLocationId: ReadonlyMap<string, EffectiveRateRecord[]>
): LocationLaborRateView[] {
  return locations
    .filter((location) => !location.archivedAt)
    .flatMap((location) => {
      const rates = ratesByLocationId.get(location.id) ?? [];
      const current = resolveCurrentRate(rates);
      if (!current) {
        return [];
      }

      return [
        {
          locationId: location.id,
          locationName: location.name,
          archivedAt: location.archivedAt,
          rateMinorUnits: current.rateMinorUnits,
          currencyCode: current.currencyCode,
          effectiveStart: current.effectiveStart,
          effectiveEnd: current.effectiveEnd,
          source: classifyRateSource(current, rates, DEFAULT_CLIENT_LABOR_RATE_MINOR)
        }
      ];
    });
}

export { formatHourlyRate };
